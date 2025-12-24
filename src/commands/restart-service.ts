import { exec } from 'child_process';
import { promisify } from 'util';
import LicenseApiService from '../services/license-api-service';
import { dockerComposeAcr, fingerPrint, setDockerComposeAcr } from '../constants/app-constants';
import { spawn } from "child_process";
import chalk from 'chalk';
import ora from "ora";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const execAsync = promisify(exec);
const PROJECT = "zerothreat";

type ComposeFile = {
  services?: Record<
    string,
    {
      container_name?: string;
    }
  >;
};

export async function cleanupContainersFromCompose(
  composeFilePath: string
): Promise<void> {
  const absPath = path.resolve(composeFilePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Compose file not found: ${absPath}`);
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const compose = yaml.load(raw) as ComposeFile;

  if (!compose.services) return;

  const containerNames = Object.values(compose.services)
    .map(s => s.container_name)
    .filter(Boolean) as string[];

  for (const name of containerNames) {
    try {
      await execAsync(`docker rm -f ${name}`);
    } catch {
    }
  }
}

async function runCompose(): Promise<void> {
    await cleanupContainersFromCompose(dockerComposeAcr);
    return new Promise((resolve, reject) => {
        const child = spawn("docker", ["compose", "-f", dockerComposeAcr ,"up", "-d"], {
            stdio: ["ignore", "ignore", "pipe"],
        });
        child.on("close", code => (code === 0 ? resolve() : reject(new Error("compose failed"))));
    });
}

async function containerExists(name: string): Promise<boolean> {
    try {
        await execAsync(`docker inspect ${name}`);
        return true;
    } catch {
        return false;
    }
}

export async function restartService(): Promise<void> {
    // Start docker image a02-conduit
    const primaryContainer = 'a02-conduit'
    const pCointainerExiste = await containerExists(primaryContainer)
    try{
        if(pCointainerExiste){
            await execAsync(`docker start ${primaryContainer}`);
        } else {
            await execAsync(`docker run -d  --restart unless-stopped  -p 3201:3201  --name ${primaryContainer}  --network zerothreat-onprem-nw  -v /var/run/docker.sock:/var/run/docker.sock  -v zt-license-data:/app/projects/api/administration/zt-license-db  ztonpremacr-abhbbthkbyh5e8hu.azurecr.io/${primaryContainer}`);
        }
        await new Promise(r => setTimeout(r, 5000));
    } catch(err:any) {
        console.log(chalk.red(err));
        return
    }
    const varifySpinner = ora('Verifying your system …')
    const dockerUpSpinner = ora('Spinning up containers… 🐳')
    const licenseService = new LicenseApiService();
    varifySpinner.start();

    // Call getSystemUp from license api service
    try{
        await licenseService.getSystemUp();
    } catch(error) {
        if (varifySpinner.isSpinning) varifySpinner.fail(chalk.red('Verification failed. Please check your system.'));
        console.log(chalk.red(error));
        return
    }

    // verifying signature
    try{
        await licenseService.verifySignature(fingerPrint);
        varifySpinner.succeed('System verified.');
    } catch (error) {
        if (varifySpinner.isSpinning) varifySpinner.fail(chalk.red('Verification failed. Please check your system.'));
        console.error(chalk.red(error));
        return
    }

    // Up the docker images
    try{
        const TIMEOUT_MS = 2 * 60 * 1000;

        const containerTimeout =  setTimeout(() => {
            throw new Error('TIMEOUT: Taking more time to restart, Please try again later');
        }, TIMEOUT_MS);

        dockerUpSpinner.start();
        await runCompose();
        clearTimeout(containerTimeout)
        dockerUpSpinner.succeed('Containers are up and running. 🐳🚀');
        console.log(chalk.gray('➤ You can now continue using ZeroThreat on this url : '));
        console.log(chalk.bold.blue('http://localhost:3203'))
    } catch(error) {
        if (dockerUpSpinner.isSpinning) dockerUpSpinner.fail(chalk.red('Something went wrong Container spin-up failed. 🐳💥'));
        console.log(chalk.red(error));
    } finally {
      if (dockerComposeAcr) {
          const tempDir = path.dirname(dockerComposeAcr);
          fs.rmSync(tempDir, { recursive: true, force: true });
          setDockerComposeAcr('')
      }
  }
    return
};