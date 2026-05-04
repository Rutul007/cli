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
        const child = spawn("docker", ["compose", "-f", dockerComposeAcr , "-p", PROJECT,"up", "-d"], {
            stdio: ["ignore", "ignore", "pipe"],
        });
        child.on("close", code => (code === 0 ? resolve() : reject(new Error("docker compose failed to bring containers up"))));
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
    const pContainerExists = await containerExists(primaryContainer)

    try {
        if (pContainerExists) {
            await execAsync(`docker start ${primaryContainer}`);
        } else {
            await execAsync(`docker run -d  --restart unless-stopped  -p 3201:3201  --name ${primaryContainer}  --network zerothreat-onprem-nw  -v /var/run/docker.sock:/var/run/docker.sock  -v zt-license-data:/app/projects/api/administration/zt-license-db  ztonpremacr-abhbbthkbyh5e8hu.azurecr.io/${primaryContainer}`);
        }
        await new Promise(r => setTimeout(r, 5000));
    } catch(err: any) {
        const msg: string = err?.message || String(err);
        console.log(chalk.red.bold(`\n✖ Failed to start container "${primaryContainer}"\n`));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  🐳 Docker') + chalk.gray(' — Make sure the Docker daemon is running (`sudo systemctl start docker`).'));
        console.log(chalk.magenta('  🌐 Network') + chalk.gray(` — The container network "zerothreat-onprem-nw" may not exist.`));
        console.log(chalk.magenta('  🖼️  Image') + chalk.gray(` — The container image may not be present. Try running "Activate License & Setup" first.\n`));
        return;
    }

    const varifySpinner = ora('Verifying your system …').start();
    const dockerUpSpinner = ora('Spinning up containers… 🐳');
    const licenseService = new LicenseApiService();

    // Call getSystemUp from license api service
    try {
        await licenseService.getSystemUp();
    } catch(error: any) {
        const msg: string = error?.message || String(error);
        if (varifySpinner.isSpinning) varifySpinner.fail(chalk.red('System verification failed.'));
        console.log(chalk.gray(`\n  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  📶 Network') + chalk.gray(' — Unable to contact ZeroThreat servers. Check your internet connection.'));
        console.log(chalk.magenta('  🐳 Docker') + chalk.gray(` — The "${primaryContainer}" container may not be healthy yet. Wait a moment and retry.\n`));
        return;
    }

    // verifying signature
    try {
        await licenseService.verifySignature(fingerPrint);
        varifySpinner.succeed('System verified.');
    } catch (error: any) {
        const msg: string = error?.message || String(error);
        if (varifySpinner.isSpinning) varifySpinner.fail(chalk.red('License signature verification failed.'));
        console.log(chalk.gray(`\n  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  🔑 License') + chalk.gray(' — The license may have been revoked or transferred to another machine.'));
        console.log(chalk.magenta('  🖥️  Hardware') + chalk.gray(' — A hardware change may have invalidated the machine fingerprint.'));
        console.log(chalk.gray('\n  Please contact support at support@zerothreat.ai if this issue persists.\n'));
        return;
    }

    // Up the docker images — with proper timeout using Promise.race instead of setTimeout throw
    const TIMEOUT_MS = 2 * 60 * 1000;

    try {
        dockerUpSpinner.start();
        await Promise.race([
            runCompose(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timed out after 2 minutes. The containers are taking longer than expected to start.')), TIMEOUT_MS)
            ),
        ]);
        dockerUpSpinner.succeed('Containers are up and running. 🐳🚀');
        console.log(chalk.gray('➤ You can now continue using ZeroThreat at:'));
        console.log(chalk.bold.blue('   http://localhost:3203\n'));
    } catch(error: any) {
        const msg: string = error?.message || String(error);
        if (dockerUpSpinner.isSpinning) dockerUpSpinner.fail(chalk.red('Container start-up failed. 🐳💥'));
        console.log(chalk.gray(`\n  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  🐳 Docker Compose') + chalk.gray(' — One or more services in the compose file may have failed.'));
        console.log(chalk.magenta('  💾 Resources') + chalk.gray(' — Insufficient disk space or memory on this machine.'));
        console.log(chalk.magenta('  ⏱️  Timeout') + chalk.gray(' — If the system timed out, wait a moment and try "Restart" again.\n'));
        console.log(chalk.gray('  Run `docker ps -a` to inspect the state of individual containers.\n'));
    } finally {
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
            setDockerComposeAcr('');
        }
    }
};