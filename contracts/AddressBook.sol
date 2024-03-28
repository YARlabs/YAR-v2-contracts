// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ERC1967ProxyCreate2 } from "./utils/ERC1967ProxyCreate2.sol";
import { IssuedERC20 } from "./tokens/IssuedERC20.sol";

contract AddressBook is UUPSUpgradeable {
    address public feeToken;

    struct Admins {
        address owner;
        address transferApprover;
        address transferValidator;
    }
    Admins public admins;

    address public treasury;

    bool public isGaslessNetwork;

    function initialize(Admins calldata _admins, address _feeToken, bool _isGaslessNetwork) public initializer {
        admins = _admins;
        feeToken = _feeToken;
        isGaslessNetwork = _isGaslessNetwork;
    }

    function requireOnlyOwner(address _account) public view {
        require(_account == admins.owner, "only owner!");
    }

    function requireTransferValidator(address _account) public view {
        require(_account == admins.transferValidator, "only transfer validator!");
    }
    
    function requireTransferApprover(bytes32 _messageHash, bytes calldata _signature) external view {
        require(SignatureChecker.isValidSignatureNow(
            admins.transferApprover,
            ECDSA.toEthSignedMessageHash(_messageHash),
            _signature
        ), "only transfer approver!");
    }

    function setTransferApprover(address _account) public {
        requireOnlyOwner(msg.sender);
        admins.transferApprover = _account;
    }

    function setTreasury(address _contract) public {
        require(treasury == address(0), "treasury already setted!");
        treasury = _contract;
    }

    function _authorizeUpgrade(address) internal view override {
        requireOnlyOwner(msg.sender);
    }

    constructor() {
        _disableInitializers();
    }
}
