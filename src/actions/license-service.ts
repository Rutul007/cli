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
import AcrTokenError from "../utils/acr-error";

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

    console.log(chalk.cyan(`\n  Pulling ${images.length} image${images.length > 1 ? 's' : ''}...\n`));

    const BATCH_SIZE = 5;
    let aborted = false;
    let abortError: Error | undefined;

    for (let batchStart = 0; batchStart < images.length; batchStart += BATCH_SIZE) {
        if (aborted) break;

        const batch = images.slice(batchStart, batchStart + BATCH_SIZE);
        const activeStreams: NodeJS.ReadableStream[] = [];
        const activePulling = new Set<number>();

        // Initialize tracking for all images in this batch
        batch.forEach((_, i) => activePulling.add(batchStart + i + 1));

        const spinner = ora(chalk.cyan(`  Pulling [${[...activePulling].join(', ')}]`)).start();

        const updateSpinnerText = () => {
            if (activePulling.size > 0) {
                spinner.text = chalk.cyan(`  Pulling [${[...activePulling].sort((a, b) => a - b).join(', ')}]`);
            }
        };

        const abortBatch = () => {
            for (const stream of activeStreams) {
                try { (stream as any).destroy?.(); } catch {}
            }
            activeStreams.length = 0;
        };

        const pullSingleImage = async (image: string, index: number): Promise<void> => {
            const globalIndex = batchStart + index;
            const displayIndex = globalIndex + 1;
            const prefix = chalk.gray(`[${displayIndex}/${images.length}]`);
            let lastError: Error | undefined;

            for (let attempt = 1; attempt <= 3; attempt++) {
                if (aborted) return;
                try {
                    await new Promise<void>((resolve, reject) => {
                        docker.pull(image, { authconfig: auth }, (err, stream) => {
                            if (err) return reject(err);
                            if (!stream) return reject(new Error("No stream received"));
                            activeStreams.push(stream);
                            if (aborted) {
                                try { (stream as any).destroy?.(); } catch {}
                                return reject(new Error("Aborted"));
                            }
                            docker.modem.followProgress(
                                stream,
                                err => err ? reject(err) : resolve(),
                                () => {}
                            );
                        });
                    });
                    break;
                } catch (err: any) {
                    if (aborted) return;
                    lastError = err;
                    if (attempt < 3) {
                        spinner.stop();
                        console.log(chalk.gray(`${prefix} ${chalk.white(image)} ${chalk.yellow(`↻ Retry ${attempt}/3`)} ${chalk.gray('— waiting 2s…')} \n Reason : ${err}`));
                        spinner.start();
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            if (aborted) return;

            if (lastError) {
                aborted = true;
                abortError = lastError;
                abortBatch();
                activePulling.delete(displayIndex);
                spinner.fail(`${chalk.red('✖')} ${prefix} ${chalk.white(image)} ${chalk.red('Failed after 3 attempts')}\n    ${chalk.gray(lastError.message)}`);
                return;
            }

            // Remove completed image from active set and update spinner
            activePulling.delete(displayIndex);
            spinner.stop();
            console.log(`${chalk.green('  ✔')} ${prefix} ${chalk.green(image)}`);
            if (activePulling.size > 0) {
                spinner.start();
                updateSpinnerText();
            }
        };

        await Promise.all(batch.map((image, index) => pullSingleImage(image, index)));

        // Stop spinner if still running after batch completes
        if (spinner.isSpinning) spinner.stop();

        if (aborted && abortError) {
            throw abortError;
        }
    }

    console.log(chalk.greenBright('\n  ✔ All images pulled successfully\n'));
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
    const spinner = ora('Verifying your license…').start();
    try {
        const {dockerAuth,activationToken} = await acrTokenService.getAcrToken(licenseKey, emailId, machineId);
        spinner.succeed('License verified.');
        auth = dockerAuth;
        token = activationToken;
        if (dockerComposeAcr) {
            COMPOSE_FILE = dockerComposeAcr;
        }
        console.log(">> Setting up application ...");
        await ensureNetwork();
        await pullImages();
        await runCompose(["up", "-d" , "--pull", "never"]);
        //Wait for 10 minutes to allow sql server to start
        const sqlContainerWaitSpinner = ora('Waiting for SQL Server to start...').start();
        const SqlSuccess = await checkSqlSuccess();
        if (!SqlSuccess) {
            sqlContainerWaitSpinner.fail("Unable to complete database setup.")
            throw new Error("Please try again later.");
        }
        sqlContainerWaitSpinner.succeed("connected to database.");
        
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
                table.options.style.border = ['green'];
                table.push([chalk.bold.green(res.message)]);
                console.log(table.toString());
            } else {
                table.options.style.border = ['red'];
                table.push([chalk.bold.red(res.message)]);
                console.log(table.toString());
                console.log(chalk.gray('\n  The server rejected the deactivation request.'));
                console.log(chalk.gray('  Please verify the deactivation token and try again.\n'));
            }
        } catch (error: any) {
            const msg: string = error?.message || String(error);
            if (spinner.isSpinning) spinner.fail(chalk.red('Deactivation request failed.'));
            table.options.style.border = ['red'];
            table.push([chalk.bold.red(`Error: ${msg}`)]);
            console.log(table.toString());
            console.log(chalk.gray('\n  Possible Causes:'));
            console.log(chalk.magenta('  📶 Network') + chalk.gray(' — Could not reach the ZeroThreat servers. Check your internet connection.'));
            console.log(chalk.magenta('  🗝️  Token') + chalk.gray(' — The deactivation token may be invalid or already used.\n'));
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
        spinner.succeed('License verified.');
        auth = dockerAuth;
        if (dockerComposeAcr) {
            COMPOSE_FILE = dockerComposeAcr;
        }
        console.log(">> Setting up application ...");
        await ensureNetwork();
        await pullImages();
        await runCompose(["up", "-d" , "--pull", "never"]);
        //Wait for 10 minutes to allow sql server to start
        const sqlContainerWaitSpinner = ora('Waiting for SQL Server to start...').start();
        const SqlSuccess = await checkSqlSuccess();
        if (!SqlSuccess) {
            sqlContainerWaitSpinner.fail("Unable to complete database setup.")
            throw new Error("Unable to complete database setup. Please try again later.");
        }
        sqlContainerWaitSpinner.succeed("connected to database.");
        console.log(chalk.greenBright("\nZeroThreat updated successfully.\n"));
    } catch (error: any) {
        const msg: string = error?.message || String(error);
        if (spinner.isSpinning) spinner.fail(chalk.red('Update verification failed.'));
        if (error instanceof AcrTokenError) {
            console.log(chalk.red.bold('\n✖ License Verification Failed\n'));
            console.log(chalk.gray(`  Reason: ${msg}\n`));
            console.log(chalk.bold('  Possible Causes:'));
            console.log(chalk.magenta('  🗝️  License') + chalk.gray(' — Your subscription may have expired or been revoked.'));
            console.log(chalk.magenta('  📶 Network') + chalk.gray(' — Ensure you have an active internet connection.\n'));
            return;
        }
        throw new Error(msg);
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