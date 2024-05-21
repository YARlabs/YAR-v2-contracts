// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract YarERC721 is ERC721 {

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    mapping(uint256 => string) uris;

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        return uris[tokenId];
    }

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function mint(address to, uint256 tokenId, string calldata _uri) external {
        _mint(to, tokenId);
        uris[tokenId] = _uri;
    }
}