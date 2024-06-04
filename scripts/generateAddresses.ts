import { ethers } from 'ethers';
import config from '../hardhat.config';
import fs from 'fs';
import { exec } from 'child_process';

function cleanAbi(data: any) {
    for (const key in data) {
        if (key === 'abi') {
            delete data[key];
            continue;
        }

        if (typeof data[key] === 'object') {
            data[key] = cleanAbi(data[key]);
        }
    }

    return data;
}

const aExec = (cmd: string) => new Promise((resolve, reject) => exec(cmd, (err, stdout, stderr) => {
    if (err) reject(err);
    if (stdout) resolve(stdout);
    if (stderr) reject(stderr);
}))

async function app() {
    await aExec('hardhat deploy --export-all addresses.json', );
    const addresses: any = await import('../addresses.json');
    const newAddresses: any = {};

    for (const address in addresses) {
        if (['default', String(config.networks?.hardhat?.chainId)].includes(address)) continue;

        console.log(address);
        newAddresses[address] = [];

        for (const data of addresses[address]) {
            newAddresses[address].push(cleanAbi(data));
        }
    }

    fs.writeFileSync('addresses.json', JSON.stringify(newAddresses, null, 4));
    process.exit(1);
}

app();