// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { YarLib } from "../../YarLib.sol";
import { YarRequest } from "../../YarRequest.sol";
import { YarResponse } from "../../YarResponse.sol";
import { ERC1967ProxyInitializable } from "../../utils/ERC1967ProxyInitializable.sol";
import { ERC1967Utils } from "../../utils/ERC1967Utils.sol";
import { BridgedEIP20 } from "./BridgedEIP20.sol";

contract YarBridge20 {
    using SafeERC20 for IERC20Metadata;

    address public owner;

    address public yarRequest;
    address public yarResponse;

    address public bridgedTokenImplementation;

    mapping(address bridgedToken => bool exists) public isBridgedToken;

    uint256 public chainId;

    struct PeerInfo {
        address peerAddress;
        string nativeSymbol;
    }

    mapping(uint256 => PeerInfo) public peers;

    string public nativeName;
    string public nativeSymbol;
    uint8 public nativeDecimals;

    function setNativeInfo(string memory _nativeName, string memory _nativeSymbol) external {
        require(msg.sender == owner, "only owner!");

        nativeName = _nativeName;
        nativeSymbol = _nativeSymbol;
    }

    function setDecimals(uint8 _decimals) external {
        require(msg.sender == owner, "only owner!");

        nativeDecimals = _decimals;
    }

    function setPeer(uint256 newChainId, address newPeer, string calldata newPeerNativeSymbol) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = PeerInfo(newPeer, newPeerNativeSymbol);
    }

    function getPeer(uint256 _chainId) public view returns (PeerInfo memory) {
        PeerInfo memory peer = peers[_chainId];

        if (peer.peerAddress == address(0)) {
            return PeerInfo(address(this), "");
        } else {
            return peer;
        }
    }

    constructor(
        string memory initialNativeName,
        string memory initialNativeSymbol,
        uint8 initialNativeDecimals,
        address intialYarRequest,
        address intialYarResponse
    ) {
        nativeName = initialNativeName;
        nativeSymbol = initialNativeSymbol;
        nativeDecimals = initialNativeDecimals;
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
        bridgedTokenImplementation = address(new BridgedEIP20());
        chainId = block.chainid;
        owner = msg.sender;
    }

    function needDeploy(
        uint256 originalChainId,
        address originalToken
    ) external view returns (bool) {
        if (originalChainId == chainId) return false; // no deploy for original chain
        bool alreadyDeployed = isBridgedToken[
            getBridgedTokenAddress(originalChainId, originalToken)
        ];
        return alreadyDeployed == false; // deploy if not exists deployment
    }

    function deployFrom(
        uint256 originalChainId,
        address originalToken,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external {
        require(msg.sender == yarResponse, "only yarRequest!");
        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId).peerAddress == trustedYarTx.sender, "not peer!");

        address bridgedToken = getBridgedTokenAddress(originalChainId, originalToken);
        require(isBridgedToken[bridgedToken] == false, "already exists!");

        _deployBridgedToken(originalChainId, originalToken, name, symbol, decimals);
    }

    function deployTo(address token, uint256 targetChainId) external returns (YarLib.YarTX memory) {
        string memory name;
        string memory symbol;
        uint8 decimals;
        if (token == address(0)) {
            name = nativeName;
            symbol = nativeSymbol;
            decimals = nativeDecimals;
        } else {
            name = IERC20Metadata(token).name();
            symbol = IERC20Metadata(token).symbol();
            decimals = IERC20Metadata(token).decimals();
        }

        uint256 originalChain;
        address originalToken;
        if (isBridgedToken[token]) {
            originalChain = BridgedEIP20(token).originalChain();
            originalToken = BridgedEIP20(token).originalToken();
            name = BridgedEIP20(token).originalTokenName();
            symbol = BridgedEIP20(token).originalTokenSymbol();
        } else {
            originalChain = chainId;
            originalToken = token;
        }

        YarLib.YarTX memory yarTx = YarLib.YarTX(
            chainId,
            address(this),
            msg.sender,
            targetChainId,
            getPeer(targetChainId).peerAddress,
            0,
            abi.encodeWithSelector(
                YarBridge20.deployFrom.selector,
                originalChain,
                originalToken,
                name,
                symbol,
                decimals
            ),
            0
        );

        return YarRequest(yarRequest).send(yarTx);
    }

    function transferFrom(
        uint256 originalChainId,
        address originalToken,
        uint256 amount,
        address recipient
    ) external {
        require(msg.sender == yarResponse, "only yarResponse!");
        YarLib.YarTX memory trustedYarTx = YarResponse(yarResponse).trustedYarTx();
        require(getPeer(trustedYarTx.initialChainId).peerAddress == trustedYarTx.sender, "not peer!");
        if (originalChainId == chainId) {
            if (originalToken == address(0)) {
                (bool success, bytes memory result) = recipient.call{ value: amount }("");
                if (success == false) {
                    assembly {
                        revert(add(result, 32), mload(result))
                    }
                }
            } else {
                IERC20Metadata(originalToken).safeTransfer(recipient, amount);
            }
        } else {
            address bridgedToken = getBridgedTokenAddress(originalChainId, originalToken);
            require(isBridgedToken[bridgedToken], "before deploy bridged token!");
            BridgedEIP20(bridgedToken).mint(recipient, amount);
        }
    }

    function transferTo(
        address token,
        uint256 amount,
        uint256 targetChainId,
        address recipient
    ) external payable returns (YarLib.YarTX memory) {
        uint256 transferAmount = amount;

        if (token == address(0)) {
            require(msg.value == transferAmount, "transferAmount!");
        } else {
            require(msg.value == 0, "msg.value != 0");
            IERC20Metadata(token).safeTransferFrom(msg.sender, address(this), transferAmount);
        }

        bool _isBridgedToken = isBridgedToken[token];

        uint256 originalChainId = _isBridgedToken ? BridgedEIP20(token).originalChain() : chainId;
        address originalToken = _isBridgedToken ? BridgedEIP20(token).originalToken() : token;

        bytes memory targetTx = abi.encodeWithSelector(
            YarBridge20.transferFrom.selector,
            originalChainId,
            originalToken,
            amount,
            recipient
        );

        YarLib.YarTX memory yarTX = YarLib.YarTX(
            chainId,
            address(this),
            msg.sender,
            targetChainId,
            getPeer(targetChainId).peerAddress,
            0,
            targetTx,
            0
        );

        return YarRequest(yarRequest).send(yarTX);
    }

    function getBridgedTokenAddress(
        uint256 originalChainId,
        address originalToken
    ) public view returns (address) {
        return ERC1967Utils.getAddress(keccak256(abi.encodePacked(originalChainId, originalToken)));
    }

    function _deployBridgedToken(
        uint256 originalChainId,
        address originalToken,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(originalChainId, originalToken));
        ERC1967ProxyInitializable bridgedToken = new ERC1967ProxyInitializable{ salt: salt }();
        bridgedToken.init(
            bridgedTokenImplementation,
            abi.encodeWithSelector(
                BridgedEIP20.initialize.selector,
                originalChainId,
                originalToken,
                getPeer(originalChainId).nativeSymbol,
                name,
                symbol,
                decimals
            )
        );

        address bridgedTokenAddress = address(bridgedToken);
        isBridgedToken[bridgedTokenAddress] = true;
        return bridgedTokenAddress;
    }
}
