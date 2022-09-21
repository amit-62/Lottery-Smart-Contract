const { ethers, network } = require("hardhat")
const fs = require("fs")
const FRONT_END_ADDRESSES_FILE = "../lottery-frontend/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../lottery-frontend/constants/abi.json"

module.exports = async function() {
    if (process.env.UPDATE_FRONT_END){
        console.log("updating front end")
        await updateContractAddresses()
        await updateAbi();
    }
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const currenttAddresses  = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    if(chainId in currenttAddresses){
        if(!currenttAddresses[chainId].includes(raffle.address)){
            currenttAddresses[chainId].push(raffle.address)
        }
    }
    else{
        currenttAddresses[chainId] = [raffle.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currenttAddresses))
}

module.exports.tags = ["all", "frontend"]