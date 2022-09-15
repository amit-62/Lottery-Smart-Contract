const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-confirg")

const BASE_FEE = ethers.utils.parseEther("0.25")
const GAS_PRICE_LINK = 1e9

module.exports = async function({getNamedAccounts, deployments}) {
    const {deploy, log} = deployments
    const {deployer} = await getNamedAccounts()
    const chainId = network.config.chainId

    const args = [BASE_FEE, GAS_PRICE_LINK] 
    if (developmentChains.includes(network.name)) {
        console.log("Local network detected deployng Mock...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
    }

    console.log("mock deployed..")
    console.log("--------------------------B")

}

module.exports.tags = ["all", "mocks"]