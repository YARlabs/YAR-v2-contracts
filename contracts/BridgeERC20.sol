// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ERC1967ProxyCreate2 } from "./utils/ERC1967ProxyCreate2.sol";
import { IssuedERC20 } from "./tokens/IssuedERC20.sol";
import { IAddressBook } from "./interfaces/IAddressBook.sol";

contract BridgeERC20 is UUPSUpgradeable {
    using SafeERC20 for IERC20Metadata;

    IAddressBook public addressBook;

    uint256 public nonce;

    bool public isProxyChain;

    mapping(address => bool) public issuedTokens;

    mapping(uint256 => mapping(uint256 => bool)) public registeredNonces;

    address public issuedTokenImplementation;

    uint256 public initBlock;

    string public nativeName;
    string public nativeSymbol;
    uint8 public nativeDecimals;
    uint256 public nativeTransferGasLimit;

    /// @notice Signatures have already been registered
    mapping(bytes32 => bool) public alreadyVerified;

    event TransferToOtherChain(
        bytes32 indexed transferId,
        uint256 nonce,
        uint256 initialChain,
        uint256 originalChain,
        address originalTokenAddress,
        uint256 targetChain,
        uint256 tokenAmount,
        address sender,
        address recipient,
        string tokenName,
        string tokenSymbol,
        uint8 tokenDecimals
    );

    event TransferFromOtherChain(
        bytes32 indexed transferId,
        uint256 externalNonce,
        uint256 originalChain,
        address originalToken,
        uint256 initialChain,
        uint256 targetChain,
        uint256 amount,
        address sender,
        address recipient
    );

    function currentChain() external view returns(uint256) {
        return addressBook.chainId();
    }

    function initialize(
        address _addressBook,
        bool _isProxyChain,
        string memory _nativeName,
        string memory _nativeSymbol,
        uint8 _nativeDecimals,
        uint256 _nativeTransferGasLimit
    ) public initializer {
        addressBook = IAddressBook(_addressBook);
        initBlock = block.number;
        isProxyChain = _isProxyChain;
        issuedTokenImplementation = address(new IssuedERC20());
        nativeName = _nativeName;
        nativeSymbol = _nativeSymbol;
        nativeDecimals = _nativeDecimals;
        nativeTransferGasLimit = _nativeTransferGasLimit;
    }

    function _authorizeUpgrade(address) internal view override {
        addressBook.requireOnlyOwner(msg.sender);
    }

    constructor() {
        _disableInitializers();
    }

    function getTransferId(uint256 _nonce, uint256 _initialChain) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_nonce, _initialChain));
    }

    function tranferToOtherChain(
        address _transferedToken,
        uint256 _amount,
        uint256 _targetChain,
        address _recipient,
        address _feeToken,
        uint256 _fees,
        uint256 _signatureExpired,
        bytes calldata _signature
    ) external payable {
        require(_amount > 0, "BridgeERC20: _amount < 0");

        IAddressBook _addressBook = addressBook;

        require(block.timestamp <= _signatureExpired, "_signatureExpired!");

        bytes32 messageHash = keccak256(
                abi.encodePacked(
                    _addressBook.chainId(),
                    address(this),
                    BridgeERC20.tranferToOtherChain.selector,
                    msg.sender,
                    _transferedToken,
                    _amount,
                    _targetChain,
                    _recipient,
                    _feeToken,
                    _fees,
                    _signatureExpired
                )
            );
        require(alreadyVerified[messageHash] == false, "signature already used!");
        _addressBook.requireTransferApprover(messageHash, _signature);
        alreadyVerified[messageHash] = true;

        address _treasury = _addressBook.treasury();
        require(_feeToken == _addressBook.feeToken(), "fee token changed!");
        if (_feeToken == address(0)) {
            require(msg.value == _fees, "msg.value != _fees");
            (bool success, ) = _treasury.call{ value: _fees }("");
            require(success, "native token transfer failed!");
        } else {
            IERC20Metadata(_feeToken).safeTransferFrom(msg.sender, _treasury, _fees);
        }

        bool isIssuedToken = issuedTokens[_transferedToken];
        uint256 initialChain = _addressBook.chainId();
        uint256 _nonce = nonce++;
        uint256 originalChain;
        address originalToken;
        string memory tokenName;
        string memory tokenSymbol;
        uint8 tokenDecimals;

        if (isIssuedToken) {
            // There ISSUED token
            IssuedERC20 issuedToken = IssuedERC20(_transferedToken);
            (originalChain, originalToken, tokenName, tokenSymbol, tokenDecimals) = issuedToken
                .getOriginalTokenInfo();
            if (originalChain == _targetChain && isProxyChain) {
                issuedToken.permissionedTransferFrom(msg.sender, address(this), _amount);
            } else {
                issuedToken.burn(msg.sender, _amount);
            }
        } else {
            // There ORIGINAL token
            originalChain = initialChain;
            originalToken = _transferedToken;
            if (_transferedToken == address(0)) {
                // Native
                require(_amount == msg.value, "amount < msg.value!");
                tokenName = nativeName;
                tokenSymbol = nativeSymbol;
                tokenDecimals = nativeDecimals;
            } else {
                // ERC20
                IERC20Metadata token = IERC20Metadata(_transferedToken);

                try token.name() returns (string memory _tokenName) {
                    tokenName = _tokenName;
                } catch {
                    tokenName = "";
                }
                try token.symbol() returns (string memory _tokenSymbol) {
                    tokenSymbol = _tokenSymbol;
                } catch {
                    tokenSymbol = "";
                }
                try token.decimals() returns (uint8 _tokenDecimals) {
                    tokenDecimals = _tokenDecimals;
                } catch {
                    tokenDecimals = 1;
                }
                token.safeTransferFrom(msg.sender, address(this), _amount);
            }
        }

        emit TransferToOtherChain(
            getTransferId(_nonce, initialChain),
            _nonce,
            initialChain,
            originalChain,
            originalToken,
            _targetChain,
            _amount,
            msg.sender,
            _recipient,
            tokenName,
            tokenSymbol,
            tokenDecimals
        );
    }

    struct TokenInfo {
        string name;
        string symbol;
        uint8 decimals;
    }

    function tranferFromOtherChain(
        uint256 _externalNonce,
        uint256 _originalChain,
        address _originalToken,
        uint256 _initialChain,
        uint256 _targetChain,
        uint256 _amount,
        address _sender,
        address _recipient,
        TokenInfo calldata _tokenInfo
    ) external {
        IAddressBook _addressBook = addressBook;

        _addressBook.requireTransferValidator(msg.sender);

        require(
            !registeredNonces[_initialChain][_externalNonce],
            "BridgeERC20: nonce already registered"
        );

        registeredNonces[_initialChain][_externalNonce] = true;

        uint256 _currentChain = _addressBook.chainId();

        require(_initialChain != _currentChain, "BridgeERC20: initialChain == currentChain");

        if (_currentChain == _targetChain) {
            // This is TARGET chain
            if (_currentChain == _originalChain) {
                // This is ORIGINAL chain
                if (_originalToken == address(0)) {
                    // Native
                    (bool success, ) = payable(_recipient).call{
                        value: _amount,
                        gas: nativeTransferGasLimit
                    }("");
                    require(success, "failed transfer native tokens!");
                } else {
                    // ERC20
                    IERC20Metadata(_originalToken).safeTransfer(_recipient, _amount);
                }
            } else {
                // This is SECONDARY chain
                address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);
                if (!isIssuedTokenPublished(issuedTokenAddress))
                    publishNewToken(_originalChain, _originalToken, _tokenInfo);
                IssuedERC20(issuedTokenAddress).mint(_recipient, _amount);
            }

            emit TransferFromOtherChain(
                getTransferId(_externalNonce, _initialChain),
                _externalNonce,
                _originalChain,
                _originalToken,
                _initialChain,
                _targetChain,
                _amount,
                _sender,
                _recipient
            );
        } else {
            // This is PROXY chain
            require(isProxyChain, "BridgeERC20: Only proxy bridge!");

            address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);
            if (!isIssuedTokenPublished(issuedTokenAddress))
                publishNewToken(_originalChain, _originalToken, _tokenInfo);

            if (_targetChain == _originalChain) {
                // BURN PROXY ISSUED TOKENS
                IssuedERC20(issuedTokenAddress).burn(address(this), _amount);
            } else if (_initialChain == _originalChain) {
                // LOCK PROXY ISSUED TOKENS
                IssuedERC20(issuedTokenAddress).mint(address(this), _amount);
            }

            emit TransferToOtherChain(
                getTransferId(_externalNonce, _initialChain),
                _externalNonce,
                _initialChain,
                _originalChain,
                _originalToken,
                _targetChain,
                _amount,
                _sender,
                _recipient,
                _tokenInfo.name,
                _tokenInfo.symbol,
                _tokenInfo.decimals
            );
        }
    }

    function isIssuedTokenPublished(address _issuedToken) public view returns (bool) {
        return issuedTokens[_issuedToken];
    }

    function getIssuedTokenAddress(
        uint256 _originalChain,
        address _originalToken
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
        address _originalToken,
        TokenInfo calldata _tokenInfo
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_originalChain, _originalToken));
        ERC1967ProxyCreate2 issuedToken = new ERC1967ProxyCreate2{ salt: salt }();
        issuedToken.init(
            issuedTokenImplementation,
            abi.encodeWithSelector(
                IssuedERC20.initialize.selector,
                _originalChain,
                _originalToken,
                _tokenInfo.name,
                _tokenInfo.symbol,
                _tokenInfo.decimals
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
        address _originalToken,
        address _account
    ) external view returns (uint256) {
        if (addressBook.chainId() == _originalChain) {
            if (_originalToken == address(0)) {
                return _account.balance;
            } else {
                return IERC20Metadata(_originalToken).balanceOf(_account);
            }
        }

        address issuedTokenAddress = getIssuedTokenAddress(_originalChain, _originalToken);

        if (!isIssuedTokenPublished(issuedTokenAddress)) return 0;
        return IERC20Metadata(issuedTokenAddress).balanceOf(_account);
    }
}
