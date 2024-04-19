// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

library YarLib {
    struct YarTX {
        uint256 initialChainId;
        address sender;
        address payer;
        uint256 targetChainId;
        address target;
        uint256 value;
        bytes data;
    }
}
