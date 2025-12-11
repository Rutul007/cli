import { exec } from 'child_process';
import { promisify } from 'util';
import { ask } from '../utils/ask-que';
import chalk from 'chalk';

const execAsync = promisify(exec);

export async function SysteCheck(): Promise<void> {
    try {
        // Check OS
        const platform = process.platform;
        if (platform !== 'linux') {
            console.log('Error: Linux/Ubuntu is required for this installation.');
            return;
        }

        // Check if Docker is available
        try {
            await execAsync('docker --version');
            console.log(chalk.greenBright.bold('✓ System requirements are met. Docker is already installed.'));
            return;
        } catch {
            console.log(chalk.red('Docker is not installed.'));
        }

        // Ask user permission to install Docker
        const answer = await ask(chalk.yellowBright.bold('Do you want to install Docker? (yes/no): '));
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('Installation cancelled.');
            return;
        }

        console.log(chalk.bold('Installing Docker...'));
        
        const commands = [
            'sudo apt update',
            'sudo apt install apt-transport-https ca-certificates curl software-properties-common -y',
            'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
            'sudo apt update',
            'sudo apt install docker-ce -y',
            'sudo usermod -aG docker ${USER}',
        ];

        for (const cmd of commands) {
            console.log(`Running: ${cmd}`);
            await execAsync(cmd);
        }

        // Check if Docker is available
        await execAsync('docker --version');
        console.log(chalk.greenBright.bold('✓ System requirements are met. ✓ Docker installed successfully.'));

    } catch (error) {
        console.error(chalk.redBright.bold('Error during system check:', error));
    }
};