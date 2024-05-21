// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/ERC1967/ERC1967Proxy.sol)
pragma solidity 0.8.20;

import { ERC1967ProxyInitializable } from "./ERC1967ProxyInitializable.sol";

library ERC1967Utils {
    function getAddress(bytes32 salt) internal view returns (address) {
        return
            address(
                uint160(
                    uint(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(
                                    abi.encodePacked(type(ERC1967ProxyInitializable).creationCode)
                                )
                            )
                        )
                    )
                )
            );
    }
}
