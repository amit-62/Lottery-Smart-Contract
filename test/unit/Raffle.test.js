const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-confirg");

!developmentChains.includes(network.name)
    ?describe.skip
    :describe("Raffle Unit tests", function(){
        let raffle, vrfCoordinatorV2Mock, deployer, raffleEntranceFee, interval
        const chainId = network.config.chainId
        beforeEach(async function (){
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = interval = await raffle.getInterval()
        })

        describe("constructor", function(){
            it("Intializes the raffle correctly", async function(){
                const raffleState = await raffle.getRaffleState()
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval, networkConfig[chainId]["interval"])
            })
        })

        describe("enterRaffle", function(){
            it("revert when you don,t pay enough", async function(){
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
            })
            it("record player when they enter", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })

            it("emits event on enter", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(
                    raffle, /**contract */
                    "RaffleEnter" /**event */
                    )
            })

            it("doesnt allow entrance when raffle is calculating", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                // pretend to be a chainlink keeper
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__RaffleNotOpen")
            })
        })

        describe("checkUpkeep", function(){
            it("return false if people haven't sent enough eth", async function(){
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })

            it("return false if raffle isn't open", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                await network.provider.send("evm_mine", [])
                await raffle.performUpkeep([])
                const raffleState = await raffle.getRaffleState()
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })

            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", function(){
            it("It can only run if upkeep is true", async function(){
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })
            it("revert if checkupkeep is false", async function(){
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
            })
            it("updates the raffle state and emits a requestId", async function(){
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber() > 0)
                assert(raffleState.toString() == 1)
            })
        })

        describe("fulfillRandomWords", function(){
            beforeEach(async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })

            it("can only be called after perfomUpkeep", async () => {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })

            it("picks a winner, reset lottery, and send money", async () => {
                const additionalEntrants = 3
                const startingAccountIndex = 1
                const accounts = await ethers.getSigners()
                for(let i= startingAccountIndex; i< startingAccountIndex+additionalEntrants; i++){
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                } 
                const startingTimeStamp = await raffle.getLastTimeStamp()

                await new Promise(async (resolve, reject)=>{
                    raffle.once("WinnerPicked", async ()=>{    /**listen to event*/
                        console.log("found an event")
                        try {
                            const recentWinner = await raffle.getRecentWinner() 
                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            const numPlayer = await raffle.getNumberOfPlayers()
                            const winnerBalance = await accounts[1].getBalance()
                            assert.equal(raffleState.toString(), "0")
                            assert.equal(numPlayer.toString(),"0")
                            // assert(endingTimeStamp > startingTimeStamp)
                            assert.equal(
                                winnerBalance.toString(),
                                startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrants)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                            )
                            resolve()  // promise resolves on success
                        } catch (e) {
                            console.log(e)
                            reject(e)
                        }
                        
                    })
                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    const startingBalance = await accounts[1].getBalance()
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        txReceipt.events[1].args.requestId,
                        raffle.address
                    )

                })
            })
        })
    })