import { MockERC1155__factory } from '../typechain-types'
import config from '../hardhat.config';
import { ethers } from 'ethers';

async function app() {
    // const networkKey = 'bscTestnet';
    const networkKey = 'polygonTestnet';
    const network = config.networks![networkKey];

    const provider = new ethers.JsonRpcProvider((network as any).url);
    const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider)

    const contractAddress = '0xbB9b33A380768feC37D90F1DB9a151058f3118b0';
    const Contract = MockERC1155__factory.connect(contractAddress, wallet);

    const newOwner = '0xf1F5F87b0929289Bd16ee796C42a339Aec8DaB5a';
    const tokenId = 3;
    const amount = 10;
    const url = 'https://files.izzz.io/nft/67f36071-c11f-46e7-a6fb-b215339bd85e.json?id=3';

    console.log("Mint...");
    const tx = await Contract.mint(newOwner, tokenId, amount, url);
    await tx.wait();
    console.log("Success!");
    process.exit(1);
}

app();