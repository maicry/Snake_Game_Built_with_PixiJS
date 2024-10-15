// 初始化分数和分数显示元素
let score = 0;
const scoreElement = document.getElementById('score');

// 创建 PIXI 应用实例
const app = new PIXI.Application({
    width: 350,
    height: 550,
    backgroundColor: 0xFFFFFF,
});
document.getElementById('game-container').appendChild(app.view);

// 定义 Emoji 图标
const emojis = ['😔', '💤', '🤣', '😟', '🐎', '💩'];

// 存储方块的数组
let cells = [];
let cell1 = null;
let cell2 = null;
let selectedCell = null;
let isGameOver = false;
let countClick = 0;

// 方块类，用于创建游戏方块
class Cell {
    constructor(options) {
        const { position, status, type, left, top, right, bottom, instance } = options;
        this.type = type;
        this.position = position;
        this.status = status;
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
        this.instance = instance;
    }

    // 生成方块的 PIXI 容器
    genCell() {
        const cell = new PIXI.Container();
        const size = gameMap.size;
        const [x, y] = this.position;
        cell.type = this.type;

        const emojiSprite = new PIXI.Text(emojis[this.type], { fontSize: 35 });
        emojiSprite.anchor.set(0.5);
        cell.addChild(emojiSprite);

        // 对 Emoji 图标进行向右下的偏移
        const emojiOffsetX = 50; // 向右偏移的单位
        const emojiOffsetY = 50; // 向下偏移的单位
        emojiSprite.position.set(emojiOffsetX, emojiOffsetY);

        cell.addChild(emojiSprite);
        cell.position.set(size * x, size * y);
        cell.interactive = true;
        cell.buttonMode = true;
        cell.on('click', () => onCellClick(this));

        this.instance = cell;
    }
}

// 游戏地图类，管理游戏逻辑
class GameMap {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.matrix = [];
        this.useSwap = false;
        this.handleable = true;
        this.types = emojis.length;
    }

    // 生成空的游戏矩阵
    genMatrix() {
        const { x, y } = this;
        const row = new Array(x).fill(undefined);
        const matrix = new Array(y).fill(undefined).map(() => [...row]);
        this.matrix = matrix;
        return this;
    }

    // 随机填充游戏矩阵
    genRandom() {
        const { x, y } = this;
        this.matrix = this.matrix.map(row => row.map(() => Math.floor(Math.random() * this.types)));
        console.log(this.matrix);
        return this;
    }

    // 初始化游戏方块
    init() {
        cells = [];
        const { x, y } = this;
        for (let i = 0; i < y; i++) {
            for (let j = 0; j < x; j++) {
                const type = this.matrix[i][j];
                const random = Math.floor(Math.random() * this.types);
                cells.push(new Cell({
                    type: (type == undefined) ? random : type,
                    position: [j, i],
                    status: (type == undefined) ? 'emerge' : 'common',
                    left: undefined,
                    top: undefined,
                    right: undefined,
                    bottom: undefined,
                    instance: undefined
                }));
            }
        }
        // 设置方块的邻居关系并生成 PIXI 容器
        cells.forEach(cell => {
            const [row, col] = cell.position;
            cell.left = cells.find(_cell => {
                const [_row, _col] = _cell.position;
                return (_row === row - 1) && (_col === col);
            });
            cell.right = cells.find(_cell => {
                const [_row, _col] = _cell.position;
                return (_row === row + 1) && (_col === col);
            });
            cell.top = cells.find(_cell => {
                const [_row, _col] = _cell.position;
                return (_row === row) && (_col === col - 1);
            });
            cell.bottom = cells.find(_cell => {
                const [_row, _col] = _cell.position;
                return (_row === row) && (_col === col + 1);
            });
            cell.genCell();
        });
        return this;
    }

    // 游戏循环
    async genLoop() {
        return new Promise(async (resolve) => {
            this.handleable = false;
            await this.genCollapse(); // 检查是否有消除

            if (cells.some(cell => cell.status === 'collapse')) {
                await this.genDownfall(); // 处理方块下落
                await this.genEmerge(); // 处理方块出现
                await this.genLoop(); // 递归调用自身，继续循环
            } else {
                // 没有消除时，设置 handleable 为 true，允许下一次操作
                this.handleable = true;
            }
            resolve();
        });
    }

    // 生成乱序游戏矩阵
    async genShuffle() {
        console.log(cells);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const len = this.x * this.y;
                const arr = new Array(len).fill(0).map((_, i) => i);
                const shuffle = arr => arr.sort(() => 0.5 - Math.random());
                const shuffleArray = shuffle(arr);
                console.log(shuffleArray);
                cells.forEach((cell, index) => {
                    const newPosition = shuffleArray[index];
                    const newPositionX = Math.floor(newPosition / this.x);
                    const newPositionY = newPosition % this.x;
                    cell.instance.position.set(newPositionX * this.size, newPositionY * this.size);
                });
            }, 0);
            setTimeout(() => {
                this.regenCellMap();
                this.genCellMap();
                this.genLoop();
                resolve('ok');
            }, 500);
        });
    }

    // 交换两个方块
    async genSwap(cell1, cell2) {
        const tempPosition = cell1.position;
        cell1.position = cell2.position;
        cell2.position = tempPosition;

        // 创建位置的副本，以便在需要时恢复位置
        const tempInstancePosition1 = cell1.instance.position.clone();
        const tempInstancePosition2 = cell2.instance.position.clone();

        cell1.instance.position.set(cell1.position[0] * this.size, cell1.position[1] * this.size);
        cell2.instance.position.set(cell2.position[0] * this.size, cell2.position[1] * this.size);

        // 等待一小段时间以可视化交换动画
        await new Promise(resolve => setTimeout(resolve, 300));

        // 检查是否有可能的消除

        await this.genCollapse();
        // 执行下落和出现的动画
        await this.genDownfall();
        await this.genEmerge();

        // 如果可能，执行额外的消除操作
        await this.genCollapse();

        // 如果仍然存在消除，递归调用 this.genSwap(cell1, cell2)
        if (cells.some(cell => cell.status === 'collapse')) {
            await this.genSwap(cell1, cell2);
        }


        // 重置 handleable 标志，允许继续处理其他操作
        this.handleable = true;
        const canCollapse = await checkCollapseAfterSwap(cell1, cell2);
        if (canCollapse) {
            // 如果存在消除情况，执行消除、下落和出现的动画
            await gameMap.genCollapse();
            await gameMap.genDownfall();
            await gameMap.genEmerge();

            // 递归调用 genSwap，继续处理其他可能的消除
            await genSwap(cell1, cell2);
        } else {
            // 如果不存在消除情况，将交换的 Emoji 恢复到原来的位置
            await gameMap.genSwap(cell1, cell2);
            // 重置 handleable 标志，允许继续处理其他操作
            gameMap.handleable = true;
        }
    }
    async checkCollapseAfterSwap(cell1, cell2) {
        // 交换方块的位置
        const tempPosition = cell1.position;
        cell1.position = cell2.position;
        cell2.position = tempPosition;

        // 检查是否存在消除情况
        await gameMap.genCollapse();
        const canCollapse = cells.some(cell => cell.status === 'collapse');

        // 恢复交换的方块位置
        cell1.position = tempPosition;
        cell2.position = cell2.position;

        return canCollapse;
    }

    // 检查并执行方块消除
    // 检查并执行方块消除
// 检查并执行方块消除
    genCollapse() {
        return new Promise((resolve) => {
            let collapsedCount = 0; // 记录消除的方块数量

            // 遍历所有方块，检查是否有相邻方块的类型相同
            cells.forEach(cell => {
                const { left, right, top, bottom, type } = cell;

                // 如果左右两侧的方块类型与当前方块类型相同，则触发消除
                if (left && right && left.type === type && right.type === type) {
                    left.status = 'collapse';   // 标记左侧方块为消除状态
                    cell.status = 'collapse';   // 标记当前方块为消除状态
                    right.status = 'collapse';  // 标记右侧方块为消除状态
                    if(countClick != 0){
                        collapsedCount++;           // 增加消除的方块数量
                    }

                }

                // 如果上下两侧的方块类型与当前方块类型相同，则触发消除
                if (top && bottom && top.type === type && bottom.type === type) {
                    top.status = 'collapse';    // 标记上方方块为消除状态
                    cell.status = 'collapse';   // 标记当前方块为消除状态
                    bottom.status = 'collapse'; // 标记下方方块为消除状态
                    if(countClick != 0){
                        collapsedCount++;           // 增加消除的方块数量
                    }

                }
            });

            // 根据消除的方块数量增加分数
            if (collapsedCount > 0) {
                score += collapsedCount;
                updateScore(); // 更新分数显示
            }

            resolve();
        });
    }


    // 处理方块下落
    genDownfall() {
        return new Promise((resolve) => {
            cells.forEach(cell => {
                if (cell.status !== 'collapse') {
                    let downfallRange = 0;
                    let bottom = cell.bottom;
                    while (bottom) {
                        if (bottom.status === 'collapse') {
                            downfallRange += 1;
                        }
                        bottom = bottom.bottom;
                    }
                    cell.instance.position.y += this.size * downfallRange;
                }
            });
            resolve();
        });
    }

    // 处理方块出现
    genEmerge() {
        return new Promise((resolve) => {
            this.regenCellMap();
            this.genCellMap();
            setTimeout(() => {
                cells.forEach(cell => {
                    if (cell.status === 'emerge') {
                        cell.instance.alpha = 1;
                    }
                });
            }, 100);
            setTimeout(() => {
                resolve();
            }, 500);
        });
    }

    // 重构方块地图
    regenCellMap() {
        const size = gameMap.size;
        const findInstance = (x, y) => {
            return cells.find(item => {
                const { x: offsetX, y: offsetY } = item.instance.position;
                return (item.status !== 'collapse' && (x === offsetX / size) && (y === offsetY / size));
            })?.instance;
        };
        this.genMatrix();
        this.matrix = this.matrix.map((row, rowIndex) => row.map((item, itemIndex) => findInstance(itemIndex, rowIndex)?.type));

        console.log(this.matrix);

        this.init();
    }

    // 生成方块地图
    genCellMap() {
        app.stage.removeChildren();
        cells.forEach(cell => {
            app.stage.addChild(cell.instance);
        });
        console.log(cells);
        return this;
    }


}

// 创建游戏地图实例
let gameMap = new GameMap(6, 10, 50);
gameMap.genMatrix().genRandom();
gameMap.init().genCellMap();
gameMap.genLoop();

// 更新分数显示
function updateScore() {
    scoreElement.textContent = `Score: ${score}`;
}

// 处理点击方块事件
function onCellClick(clickedCell) {
    countClick ++;
    if (isGameOver) {
        return; // If game is over, prevent further interaction
    }
    if (gameMap.handleable) {
        if (selectedCell === null) {
            // 第一次点击方块，选中该方块
            selectedCell = clickedCell;
            selectedCell.instance.alpha = 0.5;
        } else if (selectedCell === clickedCell) {
            // 再次点击已选中的方块，取消选中状态
            selectedCell.instance.alpha = 1;
            selectedCell = null;
        } else if (['left', 'top', 'bottom', 'right'].some(item => selectedCell[item] === clickedCell)) {
            (async () => {
                await gameMap.genSwap(selectedCell, clickedCell);
                await gameMap.genLoop();

                // 只有实际玩家操作进行消除时更新分数
                if (cells.some(cell => cell.status === 'collapse')) {
                    score += countCollapses(cells);
                    updateScore();
                }

                selectedCell.instance.alpha = 1; // 重置第一个选中方块的透明度
                selectedCell = null; // 重置选中方块
            })();
        } else {
            selectedCell.instance.alpha = 1; // 重置第一个选中方块的透明度
            selectedCell = clickedCell; // 将点击的方块设置为第一个选中方块
            selectedCell.instance.alpha = 0.5; // 高亮点击的方块
        }
        gameMap.useSwap = !gameMap.useSwap;
    }
}



// 设置 PIXI 舞台的交互性
app.stage.interactive = true;
app.stage.on('click', (event) => {
    if (gameMap.handleable) {
        const clickedCell = cells.find(cell => cell.instance.containsPoint(event.data.global));
        if (clickedCell) {
            onCellClick(clickedCell);
        }
    }
});

// 初始化游戏并检查是否有可行的消除组合
async function startGame() {
    gameMap.genMatrix().genRandom();
    gameMap.init().genCellMap();
    gameMap.genLoop();
    await checkValidMoves(); // 只检查是否有可行的消除组合
    score = 0;
    updateScore();
}


// 检查是否有可行的消除组合
async function playGame() {
    const validMoveExists = await checkValidMoves();
    if (!validMoveExists) {
        isGameOver = true;
        gameOver();
    }
}

// 计算消除的方块数量
function countCollapses(cells) {
    return cells.filter(cell => cell.status === 'collapse').length;
}


// 更新分数显示
function updateScore() {
    if(countClick == 0){
        scoreElement.textContent = `Score: 0`;
    }
    else{
        scoreElement.textContent = `Score: ${score}`;
    }

}


function gameOver() {
    function gameOver() {
        alert('Game Over!');
        isGameOver = true;
    }

}

// 开始游戏
startGame();