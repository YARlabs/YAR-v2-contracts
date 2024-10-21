import { ethers } from 'ethers';
import { YarBridge20__factory } from '../typechain-types';
import config from '../hardhat.config';
import addresses from '../addresses.json';

const blackListKeys = ['hardhat', 'arbitrumTestnet'];

const getAddressByChainId = (chainId: string) => {
    return (addresses as any)[chainId]?.[0]?.contracts?.YarBridge20?.address;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function app() {
    const keys = Object.keys(config.networks!).filter(_ => !blackListKeys.includes(_));
    for (const key of keys) {
        const network = config.networks[key];
        if (!network || !network.url) continue;

        if (![10226688, 51].includes(network.chainId)) continue;
        console.log('Проверяю наименование chainId:', network.chainId);

        const provider = new ethers.JsonRpcProvider(network.url);
        const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider);

        const address = getAddressByChainId(network.chainId);
        if (!address) continue;

        const Contract = YarBridge20__factory.connect(address, wallet);

        const contractTokenName = await Contract.nativeName.staticCall();
        const contractTokenSymbol = await Contract.nativeSymbol.staticCall();

        if (network.tokenName != contractTokenName || network.tokenSymbol != contractTokenSymbol) {
            console.log('Название: изменяю', contractTokenName, 'на', network.tokenName);
            console.log('Символ: изменяю', contractTokenSymbol, 'на', network.tokenSymbol);

            const tx = await Contract.setNativeInfo(network.tokenName, network.tokenSymbol);
            await tx.wait();

            console.log('');
        }
    }

    console.log('Done!');
    process.exit(1);
}

app();