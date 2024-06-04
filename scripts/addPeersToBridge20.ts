import { ethers } from 'ethers';
import config from '../hardhat.config';
import { YarBridge20__factory } from '../typechain-types';
import { deployments } from 'hardhat'
import addresses from '../addresses.json';
import { tickerByChainId } from './utils/currency';

async function app() {
    const keys = Object.keys(config.networks!).filter(_ => !['hardhat', 'arbitrumTestnet'].includes(_));

    for (const key of keys) {
        const network = config.networks![key];
        if (!network || !(network as any)?.url) continue;

        const provider = new ethers.JsonRpcProvider((network as any).url);
        const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider);

        const peers = keys.map(_ => config.networks![_]).filter(_ => _);
        const address: string | undefined = (addresses as any)[network.chainId!][0].contracts.YarBridge20?.address;

        if (!address) continue;

        console.log('Добавляю пиры для chainId:', network.chainId);

        const Contract = YarBridge20__factory.connect(address, wallet);

        for (const peer of peers) {
            if ((peer as any).chainId == network.chainId) continue;
            const peerAddress: string | undefined = (addresses as any)[peer?.chainId!]?.[0].contracts.YarBridge20?.address;
            const nativeCurrency = tickerByChainId[peer?.chainId!];

            if (!peerAddress) {
                console.log('YarBridge not found in', peer?.chainId);
                break;
            }

            if (!nativeCurrency) {
                console.log('Native currency for peer', peer?.chainId, 'not found');
                break;
            }

            const peerFromContract = await Contract.getPeer.staticCall(peer?.chainId!);
            if (peerFromContract.nativeSymbol !== '') {console.log('Пир', peer?.chainId, 'уже был добавлен'); continue;}

            const tx = await Contract.setPeer(peer?.chainId!, peerAddress!, nativeCurrency || '');
            await tx.wait();

            console.log('Пир', peer?.chainId, 'добавлен');
        }
        console.log('\n');
    }

    console.log('Done!');
    process.exit(1);
}

app();