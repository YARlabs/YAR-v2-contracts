// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { ERC2771Forwarder } from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "hardhat/console.sol";
contract YarMetaForwarder is ERC2771Forwarder, ReentrancyGuard {
    address public peer;
    constructor() ERC2771Forwarder("YarForwarder") {}

    function _execute(
        ForwardRequestData calldata request,
        bool requireValidRequest
    ) internal virtual override nonReentrant returns (bool success) {
        peer = msg.sender;
        success = super._execute(request, requireValidRequest);
        delete peer;
    }
}
