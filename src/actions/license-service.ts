import { getMachineId } from "../utils/get-mac";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import yaml from "js-yaml";
import Dockerode from "dockerode";
import InstallerAppCryptoService from '../tools/crypto-service';
import LicenseApiService from '../services/license-api-service';
import AcrTokenService, { DockerAuth } from '../services/acr-token-service';
import { ask } from '../utils/ask-que';
import chalk from "chalk";
import Table from "cli-table3";
import { dockerComposeAcr } from "../constants/app-constants";

let COMPOSE_FILE = ""

const PROJECT = "zerothreat";
const NETWORK = "zerothreat-onprem-nw";

interface DockerComposeService {
    image: string;
    [key: string]: any;
}

interface DockerComposeFile {
    services?: Record<string, DockerComposeService>;
    [key: string]: any;
}

let auth: DockerAuth = {
    username: "",
    password: "",
    serveraddress: "",
};

const docker = new Dockerode();

async function ensureNetwork(): Promise<void> {
    const existing = await docker.listNetworks({ filters: { name: [NETWORK] } });
    if (existing.length === 0) {
        await docker.createNetwork({ Name: NETWORK, CheckDuplicate: true });
        console.log(`Network created: ${NETWORK}`);
    }
}

async function pullImages(): Promise<void> {
    const doc = yaml.load(fs.readFileSync(COMPOSE_FILE, "utf8")) as DockerComposeFile;
    const images = Object.values(doc.services || {}).map(s => s.image);

    console.log(`Pulling ${images.length} images in parallel...`);

    await Promise.all(
        images.map(image =>
            new Promise<void>((resolve, reject) => {
                docker.pull(image, { authconfig: auth }, (err, stream) => {
                    if (err) return reject(err);
                    if (!stream) return reject(new Error("No stream received"));
                    docker.modem.followProgress(
                        stream,
                        err => (err ? reject(err) : resolve()),
                        () => process.stdout.write(".")
                    );
                });
            }).then(() => console.log(`\nDone: ${image}`)
            )
        ));

    console.log("All images pulled!");
}

async function runCompose(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("docker", ["compose", "-f", COMPOSE_FILE, "-p", PROJECT, ...args], {
            stdio: "inherit",
        });
        child.on("close", code => (code === 0 ? resolve() : reject(new Error("compose failed"))));
    });
}

export async function firstIgnition(licenseKey: string, emailId: string): Promise<string> {
    console.log(">> Running first docker setup ...");
    let token = '';
    const acrTokenService = new AcrTokenService();
    const machineId =  getMachineId()
    try {
        const {dockerAuth,activationToken} = await acrTokenService.getAcrToken(licenseKey, emailId, machineId);
        auth = dockerAuth;
        token = activationToken;
        if (dockerComposeAcr) {
            COMPOSE_FILE = dockerComposeAcr;
        }
        await ensureNetwork();
        await pullImages();
        await runCompose(["up", "-d"]);
        //sleep for 30 seconds to allow sql server to start
        console.log("Waiting for SQL Server to start...");
        await new Promise(resolve => setTimeout(resolve, 30000));

    } catch (error) {
        throw error;
    } finally {
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
    return token;
}

export async function licenseDeactivate(): Promise<void> {
    console.log(chalk.dim("License deactivation initiated.. \n"));
    try {
        const deactivationToken = await ask(chalk.yellow.bold("🗝️ Enter Deactivation Token: "));
        const machineId = getMachineId();
        const licenseApi = new LicenseApiService();

        const table = new Table({
            chars: {
                "top": "═",
                "top-left": "╔",
                "top-right": "╗",
                "bottom": "═",
                "bottom-left": "╚",
                "bottom-right": "╝",
                "left": "║",
                "right": "║",
            },
        });
        try {
            const res = await licenseApi.deactivateLicense(machineId, deactivationToken);
            if (res.status) {
                table.options.style.border = ['green']
                table.push(
                    [chalk.bold.green(res.message)],
                );
                console.log(table.toString());
            } else {
                table.push(
                    [chalk.bold.green(res.message)],
                );
                console.log(table.toString());
            }
        } catch (error: any) {
            table.options.style.border = ['red']
            table.push(
                [chalk.bold.red(`DeactivateLicense error:${error.message}`)],
            );
            console.log(table.toString());
        }
    }
    catch (err: any) {
        console.log(chalk.redBright(`DeactivateLicense error: ${err.message}`));
    }
}