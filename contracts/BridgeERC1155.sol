// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ERC1967ProxyCreate2 } from "./utils/ERC1967ProxyCreate2.sol";
import { IssuedERC1155 } from "./tokens/IssuedERC1155.sol";
import { IAddressBook } from "./interfaces/IAddressBook.sol";

contract BridgeERC1155 is IERC1155Receiver, UUPSUpgradeable {
    using SafeERC20 for IERC20Metadata;

    IAddressBook public addressBook;

    address public validator;

    uint256 public currentChain;

    uint256 public nonce;

    bool public isProxyChain;

    mapping(address => bool) public issuedTokens;

    mapping(uint256 => mapping(uint256 => bool)) public registeredNonces;

    address public issuedTokenImplementation;

    uint256 public initBlock;

    /// @notice Signatures have already been registered
    mapping(bytes32 => bool) public alreadyVerified;

    event TransferToOtherChain(
        bytes32 indexed transferId,
        uint256 nonce,
        uint256 initialChain,
        uint256 originalChain,
        bytes originalTokenAddress,
        uint256 targetChain,
        uint256 tokenId,
        uint256 amount,
        bytes sender,
        bytes recipient,
        string tokenUri
    );

    event BatchTransferToOtherChain(
        bytes32 indexed transferId,
        uint256 nonce,
        uint256 initialChain,
        uint256 originalChain,
        bytes originalTokenAddress,
        uint256 targetChain,
        uint256[] tokenIds,
        uint256[] amounts,
        bytes sender,
        bytes recipient,
        string[] tokenUris
    );

    event TransferFromOtherChain(
        bytes32 indexed transferId,
        uint256 externalNonce,
        uint256 originalChain,
        bytes originalToken,
        uint256 initialChain,
        uint256 targetChain,
        uint256 tokenId,
        uint256 amount,
        bytes sender,
        bytes recipient
    );

    event BatchTransferFromOtherChain(
        bytes32 indexed transferId,
        uint256 externalNonce,
        uint256 originalChain,
        bytes originalToken,
        uint256 initialChain,
        uint256 targetChain,
        uint256[] tokenIds,
        uint256[] amounts,
        bytes sender,
        bytes recipient
    );

    function initialize(
        IAddressBook _addressBook,
        bool _isProxyChain,
        address _validator
    ) public initializer {
        addressBook = IAddressBook(_addressBook);
        initBlock = block.number;
        currentChain = block.chainid;
        isProxyChain = _isProxyChain;
        issuedTokenImplementation = address(new IssuedERC1155());
        validator = _validator;
    }

    function _authorizeUpgrade(address) internal view override {
        addressBook.requireOnlyOwner(msg.sender);
    }

    constructor() {
        _disableInitializers();
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == 0x01ffc9a7 || // ERC-165
            interfaceID == 0x4e2312e0; // ERC-1155
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function getTransferId(uint256 _nonce, uint256 _initialChain) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_nonce, _initialChain));
    }

    function tranferToOtherChain(
        address _transferedToken,
        uint256 _tokenId,
        uint256 _amount,
        uint256 _targetChain,
        bytes calldata _recipient,
        address _feeToken,
        uint256 _fees,
        uint256 _signatureExpired,
        bytes calldata _signature
    ) external payable {
        require(_amount > 0, "BridgeERC1155: amount == 0");

        IAddressBook _addressBook = addressBook;

        address _treasury = _addressBook.treasury();
        require(_feeToken == _addressBook.feeToken(), "fee token changed!");
        if (_feeToken == address(0)) {
            require(msg.value == _fees, "msg.value != _fees");
            (bool success, ) = _treasury.call{ value: _fees }("");
            require(success, "native token transfer failed!");
        } else {
            IERC20Metadata(_feeToken).safeTransferFrom(msg.sender, _treasury, _fees);
        }

        bytes32 messageHash = ECDSA.toEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    block.chainid,
                    address(this),
                    BridgeERC1155.tranferToOtherChain.selector,
                    msg.sender,
                    _transferedToken,
                    _tokenId,
                    _amount,
                    _targetChain,
                    _recipient,
                    _feeToken,
                    _fees,
                    _signatureExpired
                )
            )
        );
        require(alreadyVerified[messageHash] == false, "signature already used!");
        addressBook.requireTrasferApprover(messageHash, _signature);
        alreadyVerified[messageHash] = true;

        bool isIssuedToken = issuedTokens[_transferedToken];
        uint256 initialChain = currentChain;
        uint256 _nonce = nonce++;
        uint256 originalChain;
        bytes memory originalToken;
        string memory tokenUri;

        if (isIssuedToken) {
            // There ISSUED token
            IssuedERC1155 issuedToken = IssuedERC1155(_transferedToken);
            (originalChain, originalToken) = issuedToken.getOriginalTokenInfo();
            tokenUri = issuedToken.uri(_tokenId);
            if (originalChain == _targetChain && isProxyChain) {
                issuedToken.permissionedTransferFrom(msg.sender, address(this), _tokenId, _amount);
            } else {
                issuedToken.burn(msg.sender, _tokenId, _amount);
            }
        } else {
            // There ORIGINAL token
            IERC1155MetadataURI token = IERC1155MetadataURI(_transferedToken);
            originalChain = initialChain;
            originalToken = abi.encode(_transferedToken);
            try token.uri(_tokenId) returns (string memory _tokenUri) {
                tokenUri = _tokenUri;
            } catch {
                tokenUri = "";
            }
            token.safeTransferFrom(msg.sender, address(this), _tokenId, _amount, "");
        }

        emit TransferToOtherChain(
            getTransferId(_nonce, initialChain),
            _nonce,
            initialChain,
            originalChain,
            originalToken,
            _targetChain,
            _tokenId,
            _amount,
            abi.encode(msg.sender),
            _recipient,
            tokenUri
        );
    }

    struct TokenInfo {
        string uri;
    }

    function tranferFromOtherChain(
        uint256 _externalNonce,
        uint256 _originalChain,
        bytes calldata _originalToken,
        uint256 _initialChain,
        uint256 _targetChain,
        uint256 _tokenId,
        uint256 _amount,
        bytes calldata _sender,
        bytes calldata _recipient,
        string calldata _tokenUri
    ) external {
        addressBook.requireTransferValidator(msg.sender);

        require(
            !registeredNonces[_initialChain][_externalNonce],
            "BridgeERC1155: nonce already registered"
        );

        registeredNonces[_initialChain][_externalNonce] = true;

        uint256 _currentChain = currentChain;

        require(_initialChain != _currentChain, "BridgeERC1155: initialChain == currentChain");

        if (_currentChain == _targetChain) {
            // This is TARGET chain
            address recipientAddress = abi.decode(_recipient, (address));

            if (currentChain == _originalChain) {
                // This is ORIGINAL chain
                address originalTokenAddress = abi.decode(_originalToken, (address));
                IERC1155MetadataURI(originalTokenAddress).safeTransferFrom(
                    address(this),
                    recipientAddress,
                    _tokenId,
                    _amount,
                    ""
                );
            } else {
                // This is SECONDARY chain
                address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);
                if (!isIssuedTokenPublished(issuedTokenAddress))
                    publishNewToken(_originalChain, _originalToken);
                IssuedERC1155(issuedTokenAddress).mint(
                    recipientAddress,
                    _tokenId,
                    _amount,
                    _tokenUri
                );
            }

            emit TransferFromOtherChain(
                getTransferId(_externalNonce, _initialChain),
                _externalNonce,
                _originalChain,
                _originalToken,
                _initialChain,
                _targetChain,
                _tokenId,
                _amount,
                _sender,
                _recipient
            );
        } else {
            // This is PROXY chain
            require(isProxyChain, "BridgeERC1155: Only proxy bridge!");

            address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);
            if (!isIssuedTokenPublished(issuedTokenAddress))
                publishNewToken(_originalChain, _originalToken);

            if (_targetChain == _originalChain) {
                // BURN PROXY ISSUED TOKENS
                IssuedERC1155(issuedTokenAddress).burn(address(this), _tokenId, _amount);
            } else if (_initialChain == _originalChain) {
                // LOCK PROXY ISSUED TOKENS
                IssuedERC1155(issuedTokenAddress).mint(address(this), _tokenId, _amount, _tokenUri);
            }

            bytes memory sender = _sender; // TODO: fix Error HH600
            emit TransferToOtherChain(
                getTransferId(_externalNonce, _initialChain),
                _externalNonce,
                _initialChain,
                _originalChain,
                _originalToken,
                _targetChain,
                _tokenId,
                _amount,
                sender,
                _recipient,
                _tokenUri
            );
        }
    }

    function isIssuedTokenPublished(address _issuedToken) public view returns (bool) {
        return issuedTokens[_issuedToken];
    }

    function getIssuedTokenAddress(
        uint256 _originalChain,
        bytes calldata _originalToken
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_originalChain, _originalToken));
        return
            address(
                uint160(
                    uint(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(abi.encodePacked(type(ERC1967ProxyCreate2).creationCode))
                            )
                        )
                    )
                )
            );
    }

    function publishNewToken(
        uint256 _originalChain,
        bytes calldata _originalToken
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_originalChain, _originalToken));
        ERC1967ProxyCreate2 issuedToken = new ERC1967ProxyCreate2{ salt: salt }();
        issuedToken.init(
            issuedTokenImplementation,
            abi.encodeWithSelector(
                IssuedERC1155.initialize.selector,
                _originalChain,
                _originalToken
            )
        );

        address issuedTokenAddress = address(issuedToken);
        issuedTokens[issuedTokenAddress] = true;
        return issuedTokenAddress;
    }

    function getTranferId(uint256 _nonce, uint256 _initialChain) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_nonce, _initialChain));
    }

    function balances(
        uint256 _originalChain,
        bytes calldata _originalToken,
        address _account,
        uint256 _tokenId
    ) external view returns (uint256) {
        if (currentChain == _originalChain)
            return
                IERC1155MetadataURI(abi.decode(_originalToken, (address))).balanceOf(
                    _account,
                    _tokenId
                );

        address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);

        if (!isIssuedTokenPublished(issuedTokenAddress)) return 0;
        return IERC1155MetadataURI(issuedTokenAddress).balanceOf(_account, _tokenId);
    }
}
