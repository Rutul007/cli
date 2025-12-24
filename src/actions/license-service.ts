import { getMachineId } from "../utils/get-mac";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import yaml from "js-yaml";
import Dockerode from "dockerode";
import LicenseApiService from '../services/license-api-service';
import AcrTokenService, { DockerAuth } from '../services/acr-token-service';
import { ask } from '../utils/ask-que';
import chalk from "chalk";
import Table from "cli-table3";
import { dockerComposeAcr, fingerPrint, setDockerComposeAcr } from "../constants/app-constants";
import ora from "ora";

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
        const child = spawn("docker", ["compose","--profile", "tools", "-f", COMPOSE_FILE, "-p", PROJECT, ...args], {
            stdio: "inherit",
        });
        child.on("close", code => (code === 0 ? resolve() : reject(new Error("compose failed"))));
    });
}

async function checkSqlSuccess(): Promise<boolean> {
    const containerName = 'a01-archive';
    const timeout = 10 * 60 * 1000; // 10 minutes

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const containers = await docker.listContainers({ all: true, filters: { name: [containerName] } });
        const container = containers.find(c => c.Names.some(n => n.includes(containerName)));

        if (container && container.State === 'exited') {
            const containerObj = docker.getContainer(container.Id);
            const logs = await containerObj.logs({ stdout: true, stderr: true });
            const logString = logs.toString();
            return logString.includes('published successfully');
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return false;
}

export async function firstIgnition(licenseKey: string, emailId: string): Promise<string> {
    
    let token = '';
    const acrTokenService = new AcrTokenService();
    const machineId =  getMachineId()
    const spinner = ora('Verifying your subscription…').start();
    try {
        const {dockerAuth,activationToken} = await acrTokenService.getAcrToken(licenseKey, emailId, machineId);
        spinner.succeed('Subscription verified.');
        auth = dockerAuth;
        token = activationToken;
        if (dockerComposeAcr) {
            COMPOSE_FILE = dockerComposeAcr;
        }
        console.log(">> Setting up application ...");
        await ensureNetwork();
        await pullImages();
        await runCompose(["up", "-d"]);
        //sleep for 30 seconds to allow sql server to start
        console.log("Waiting for SQL Server to start...");
        const SqlSuccess = await checkSqlSuccess();
        if (!SqlSuccess) {
            throw new Error("Unable to complete database setup. Please try again later.");
        }
        
    } catch (error) {
        if (spinner.isSpinning) spinner.fail(chalk.red('Verification failed. Please check your details.'));
        throw error;
    } finally {
        COMPOSE_FILE = ""
        auth = {
            username: "",
            password: "",
            serveraddress: "",
        };        
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
            setDockerComposeAcr('')
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
        const spinner = ora('Removing license…').start();
        try {
            const res = await licenseApi.deactivateLicense(machineId, deactivationToken);
            spinner.succeed('License removed.');
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
            if (spinner.isSpinning) spinner.fail(chalk.red('Removal failed.'));
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

export async function updateSystemService(): Promise<void> {
    const licenseApi = new LicenseApiService();
    const spinner = ora('Verifying your subscription…').start();
    try {
        // Fetch update from compose file
        await licenseApi.getSystemUpdate();

        // verify system and get update token (acr token)
        const dockerAuth = await licenseApi.verifySystemForUpdate(fingerPrint);
        spinner.succeed('Subscription verified.');
        auth = dockerAuth;
        if (dockerComposeAcr) {
            COMPOSE_FILE = dockerComposeAcr;
        }
        console.log(">> Setting up application ...");
        await ensureNetwork();
        await pullImages();
        await runCompose(["up", "-d"]);
        //sleep for 30 seconds to allow sql server to start
        console.log("Waiting for SQL Server to start...");
        const SqlSuccess = await checkSqlSuccess();
        if (!SqlSuccess) {
            throw new Error("Unable to complete database setup. Please try again later.");
        }
    } catch (error) {
        if (spinner.isSpinning) spinner.fail(chalk.red('Verification failed. Please check your details.'));
        throw error;
    } finally {
        COMPOSE_FILE = ""
        auth = {
            username: "",
            password: "",
            serveraddress: "",
        };     
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
            setDockerComposeAcr('')
        }
    }
}