import { exec } from 'child_process';
import { promisify } from 'util';
import { ask } from '../utils/ask-que';
import chalk from 'chalk';

const execAsync = promisify(exec);

export async function installDocker(): Promise<void> {
    try {
        // Check OS
        const platform = process.platform;
        if (platform !== 'linux') {
            console.log(chalk.red.bold('\n✖ Unsupported Operating System\n'));
            console.log(chalk.gray(`  Detected platform: ${chalk.yellow(platform)}`));
            console.log(chalk.gray('  ZeroThreat On-Prem requires a Linux/Ubuntu environment.'));
            console.log(chalk.gray('  Please run this installer on a Linux machine or inside a Linux VM.\n'));
            return;
        }

        // Check if Docker is available
        try {
            await execAsync('docker --version');
            console.log(chalk.greenBright.bold('✓ System requirements are met. Docker is already installed.'));
            return;
        } catch {
            console.log(chalk.yellow.bold('\n⚠ Docker is not installed on this system.\n'));
        }

        // Ask user permission to install Docker
        const answer = await ask(chalk.yellowBright.bold('Do you want to install Docker? (yes/no): '));
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log(chalk.gray('\nInstallation cancelled. Docker is required to run ZeroThreat On-Prem.'));
            console.log(chalk.gray('You can re-run this setup at any time.\n'));
            return;
        }

        console.log(chalk.bold('\nInstalling Docker, this may take a few minutes...\n'));
        
        const commands = [
            'sudo apt update',
            'sudo apt install apt-transport-https ca-certificates curl software-properties-common -y',
            'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
            'sudo apt update',
            'sudo apt install docker-ce -y',
            'sudo usermod -aG docker ${USER}'
        ];

        for (const cmd of commands) {
            console.log(chalk.gray(`  ▸ Running: ${cmd}`));
            await execAsync(cmd);
        }

        // Check if Docker is available
        await execAsync('docker --version');
        console.log(chalk.greenBright.bold('\n✓ Docker installed successfully.\n'));
        console.log(chalk.yellowBright.bold('  ⚠ Action Required: Group changes need a session refresh.\n'));
        console.log(chalk.white('  Run the following command to apply Docker group permissions:'));
        console.log(chalk.cyanBright.bold('\n  command : newgrp docker\n'));
        console.log(chalk.white('  Then re-run the ZeroThreat installer:'));

        process.exit(0);

    } catch (error: any) {
        const msg: string = error?.message || String(error);
        console.log(chalk.red.bold('\n✖ Docker installation failed\n'));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  🔑 Permissions') + chalk.gray(' — Make sure you have sudo privileges.'));
        console.log(chalk.magenta('  📶 Network')     + chalk.gray(' — apt requires internet access to download packages.'));
        console.log(chalk.magenta('  📦 Package Manager') + chalk.gray(' — Run `sudo apt update` manually and check for errors.\n'));
        console.log(chalk.gray('  If the problem persists, install Docker manually: https://docs.docker.com/engine/install/ubuntu/\n'));
    }
};