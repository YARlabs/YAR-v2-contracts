import { YarBridge20__factory } from '../typechain-types'
import config from '../hardhat.config';
import { ethers } from 'ethers';

async function app() {
    const networkKey = 'xdcTestnet';
    const network = config.networks![networkKey];

    const provider = new ethers.JsonRpcProvider((network as any).url);
    const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider);

    const contractAddress = '0x82250becFAAFdE7b1747144D53cE99Dee60F48E9';
    const Contract = YarBridge20__factory.connect(contractAddress, wallet);

    const tx = await Contract.needDeploy.staticCall(80002, "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904");
    console.log("Success!", tx);
    process.exit(1);
}

app();