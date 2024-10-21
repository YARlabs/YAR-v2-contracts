import { ethers } from 'ethers';
import { YarBridge721__factory } from '../typechain-types';
import config from '../hardhat.config';
import addresses from '../addresses.json';

const blackListKeys = ['hardhat', 'arbitrumTestnet'];

const getAddressByChainId = (chainId: string) => {
    return (addresses as any)[chainId]?.[0]?.contracts?.YarBridge721?.address;
}

async function app() {
    const keys = Object.keys(config.networks!).filter(_ => !blackListKeys.includes(_));
    for (const key of keys) {
        const network = config.networks[key];
        if (!network || !network.url) continue;

        const provider = new ethers.JsonRpcProvider(network.url);
        const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider);

        const address = getAddressByChainId(network.chainId);
        if (!address) continue;

        const peers = keys.map(_ => config.networks[_]).filter(_ => _);
        console.log('Добавляю пиры для chainId:', network.chainId);

        const Contract = YarBridge721__factory.connect(address, wallet);
        for (const peer of peers) {
            if (peer.chainId == network.chainId) continue;

            const peerAddress = getAddressByChainId(peer.chainId);
            if (!peerAddress) {
                console.log('YarBridge not found in', peer.chainId);
                continue;
            }

            const peerTokenSymbol = peer.peerSymbol;
            if (!peerTokenSymbol) {
                console.log('Native currency for peer', peer.chainId, 'not found');
                continue;
            }

            const currentPeer = await Contract.getPeer.staticCall(peer.chainId);
            if (currentPeer.nativeSymbol && currentPeer.nativeSymbol == peerTokenSymbol) {
                console.log('Пир', peer?.chainId, 'уже был добавлен как:', currentPeer.nativeSymbol);
                continue;
            }

            const tx = await Contract.setPeer(peer.chainId, peerAddress, peerTokenSymbol);
            await tx.wait();

            console.log('Пир', peer?.chainId, currentPeer.nativeSymbol === '' ? 'добавлен' : 'изменен');
        }
        console.log('\n');
    }

    console.log('Done!');
    process.exit(1);
}

app();