// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import "hardhat/console.sol";
contract YarConnector is EIP712, Nonces, ERC2771Context, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public relayer;
    address public feeOracle;
    address public feeToken;

    struct CrossCallData {
        uint256 initialChainId;
        address sender;
        address app;
        uint256 targetChainId;
        address target;
        uint256 value;
        bytes data;
        uint256 feeAmount;
    }

    string private constant PERMIT_TYPE =
        "Permit(uint256 nonce,uint256 signatureExpired,CrossCallData crossCallData)";
    string private constant CROSS_CALL_DATA_TYPE =
        "CrossCallData(uint256 initialChainId,address sender,address app,uint256 targetChainId,address target,uint256 value,bytes data,uint256 feeAmount)";

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256(abi.encodePacked(PERMIT_TYPE, CROSS_CALL_DATA_TYPE));

    bytes32 private constant CROSS_CALL_DATA_TYPEHASH =
        keccak256(abi.encodePacked(CROSS_CALL_DATA_TYPE));

    mapping(address sender => mapping(address app => mapping(bytes32 crossCallDataHash => bool approved)))
        public approvals;

    CrossCallData public trustedCrossCallData;

    event CrossCall(CrossCallData data);

    event SendFees(address depositor, address feesToken, uint256 amount);

    constructor(
        address intialYarForwarder,
        address intialRelayer,
        address initialFeeOracle,
        address initailFeeToken
    ) EIP712("YarConnector", "1") ERC2771Context(intialYarForwarder) {
        relayer = intialRelayer;
        feeOracle = initialFeeOracle;
        feeToken = initailFeeToken;
    }

    function sendFees(uint256 feeAmount) public payable {
        if (feeToken == address(0)) {
            require(msg.value == feeAmount, "feeAmount!");
        } else {
            IERC20(feeToken).safeTransferFrom(_msgSender(), address(this), feeAmount);
        }
        emit SendFees(_msgSender(), feeToken, feeAmount);
    }

    function crossCallGateway(
        bytes calldata appData,
        CrossCallData calldata crossCallDataData
    ) external payable {
        approveCrossCall(crossCallDataData);
        (bool success, bytes memory result) = crossCallDataData.app.call{ value: msg.value }(
            appData
        );
        if (success == false) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function approveCrossCall(CrossCallData calldata crossCallDataData) public {
        require(crossCallDataData.sender == _msgSender(), "only sender!");
        _approveCrossCall(crossCallDataData);
    }

    function _approveCrossCall(CrossCallData calldata data) internal {
        approvals[data.sender][data.app][keccak256(abi.encode(data))] = true;
    }

    function crossCallFrom(CrossCallData calldata crossCallData) external payable {
        address sender = crossCallData.sender;
        address app = crossCallData.app;

        require(app == _msgSender(), "app != _msgSender()");

        bytes32 crossCallDataHash = keccak256(abi.encode(crossCallData));
        require(approvals[sender][app][crossCallDataHash], "not approved!");
        delete approvals[sender][app][crossCallDataHash];

        _crossCall(crossCallData);
    }

    function permit(
        CrossCallData calldata crossCallData,
        uint256 signatureExpired,
        bytes calldata signature
    ) external {
        require(block.timestamp < signatureExpired, "signatureExpired!");

        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                _useNonce(crossCallData.sender),
                signatureExpired,
                keccak256(
                    abi.encode(
                        CROSS_CALL_DATA_TYPEHASH,
                        crossCallData.initialChainId,
                        crossCallData.sender,
                        crossCallData.app,
                        crossCallData.targetChainId,
                        crossCallData.target,
                        crossCallData.value,
                        keccak256(crossCallData.data),
                        crossCallData.feeAmount
                    )
                )
            )
        );
        require(
            SignatureChecker.isValidSignatureNow(
                crossCallData.sender,
                _hashTypedDataV4(structHash),
                signature
            ),
            "signature!"
        );
        _approveCrossCall(crossCallData);
    }

    function crossCall(CrossCallData calldata crossCallData) external payable {
        address sender = _msgSender();

        require(crossCallData.sender == sender, "sender!");
        require(crossCallData.app == sender, "app != sender");

        _crossCall(crossCallData);
    }

    function _crossCall(CrossCallData memory crossCallData) internal {
        require(crossCallData.initialChainId == block.chainid, "initialChainId!");
        require(crossCallData.sender != address(this), "not self call!");

        if (crossCallData.feeAmount > 0) {
            sendFees(crossCallData.feeAmount);
        }
        emit CrossCall(crossCallData);
    }

    function onCrossCall(CrossCallData calldata data) external payable nonReentrant {
        require(_msgSender() == relayer, "only relayer!");
        require(data.value == msg.value, "msg.value!");
        trustedCrossCallData = data;
        (bool success, ) = data.target.call{ value: data.value }(data.data);
        require(success, "onCrossCall failed!");
        delete trustedCrossCallData;
    }
}
