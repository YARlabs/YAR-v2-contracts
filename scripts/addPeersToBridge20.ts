import { ethers } from 'ethers';
import config from '../hardhat.config';
import { YarBridge20__factory } from '../typechain-types';
import { deployments } from 'hardhat'
import addresses from '../addresses.json';
import { tickerByChainId } from './utils/currency';

async function app() {
    const keys = Object.keys(config.networks!).filter(_ => _ !== 'hardhat');

    for (const key of keys) {
        const network = config.networks![key];
        if (!network || !(network as any)?.url) continue;

        const provider = new ethers.JsonRpcProvider((network as any).url);
        const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider);

        const peers = keys.map(_ => config.networks![_]).filter(_ => _);
        const address: string | undefined = (addresses as any)[network.chainId!][0].contracts.YarBridge20?.address;

        if (!address) continue;

        const Contract = YarBridge20__factory.connect(address, wallet);

        for (const peer of peers) {
            if ((peer as any).chainId == network.chainId) continue;
            console.log(peer?.chainId);
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
            if (peerFromContract.peerAddress !== ethers.ZeroAddress) continue;

            // const tx = await Contract.setPeer(peer?.chainId!, peerAddress!, nativeCurrency || '');
            // await tx.wait();

            console.log(peer?.chainId, await Contract.getPeer.staticCall(peer?.chainId!));
        }
        console.log(network.chainId, address, '\n');
    }


    console.log('Done!');
    process.exit(1);
}

app();