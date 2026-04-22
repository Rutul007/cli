import chalk from "chalk";
import Table from "cli-table3";
import { actiavteLicenseRes } from '../services/license-api-service';


export function displayLicenseTable(response: actiavteLicenseRes): void {
    const getStatusText = (status: number) => {
        const map: Record<number, string> = {
            1: 'Active',
            2: 'Expired', 
            3: 'Inactive',
            4: 'Revoked',
            5: 'Claim Requested',
        };
        return map[status] || '❓ Unknown';
    };
    
    const getTypeText = (type: number) => {
        const map: Record<number, string> = {
            0: 'Free Credit Universal',
            1: 'Free Credit Hostname',
            2: 'Paid Credit',
            3: 'Subscription',
            4: 'Subscription Top Up',
            5: 'Promotional Credit',
            6: 'Extra Parallel Scan'
        };
        return map[type] || '❓ Unknown';
    };
    
    const table = new Table({
        head: [chalk.bold('Property'), chalk.bold('Value')],
        style: {
            border: ['gray'],
            head: [],
            compact: false
        },
        chars: { 'top': '═' , 'top-mid': '╤' , 'top-left': '╔' , 'top-right': '╗'
         , 'bottom': '═' , 'bottom-mid': '╧' , 'bottom-left': '╚' , 'bottom-right': '╝'
         , 'left': '║' , 'left-mid': '╟' , 'mid': '─' , 'mid-mid': '┼'
         , 'right': '║' , 'right-mid': '╢' , 'middle': '│' }
    });

    table.push(
        [chalk.cyan.bold('🔑 License Key'), chalk.white(response.license.licenseKey)],
        [chalk.cyan.bold('🏢 Organization'), chalk.white(response.organizationName)],
        [chalk.cyan.bold('🟢 Status'), chalk.green(getStatusText(response.license.licenseStatus))],
        [chalk.cyan.bold('📊 Plan Type'), chalk.white(getTypeText(response.license.licenseType))],
        [chalk.cyan.bold('📅 Expires At'), chalk.white(new Date(response.license.expiresAt).toLocaleDateString())]
    );

    const formatCredits = (val: number) => val >= 100000 ? 'UNLIMITED' : val.toString();

    if (response.license.scanCredits > 0) {
        table.push(['🔍 Scans', chalk.yellow.bold(formatCredits(response.license.scanCredits))]);
    }
    
    if (response.license.creditTargets > 0) {
        table.push(['🎯 Targets', chalk.yellow.bold(formatCredits(response.license.creditTargets))]);
    }
    
    if (response.license.freeCredits > 0) {
        table.push(['🎁 Free Credits', chalk.yellow.bold(formatCredits(response.license.freeCredits))]);
    }

    if (response.license.allowedHostNames?.length) {
        table.push([chalk.cyan.bold('🌐 Allowed Hosts'), chalk.white(response.license.allowedHostNames.join('\n'))]);
    }

    console.log(chalk.bold.blue('\n📊 LICENSE DETAILS'));
    console.log(table.toString());
    console.log(chalk.gray('➤ You can now start using ZeroThreat on this url : '));
    console.log(chalk.bold.blue('http://localhost:3203'))
}