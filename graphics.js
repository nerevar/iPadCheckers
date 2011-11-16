window.onload = function(){
    init();
	/*var sources = {
		green: "./img/green.png",
		blue: "./img/blue.png"
	};

	loadImages(sources, function(){
		init();
	});*/
};

/**
 * Загружает изображения в контекст и вызывает функцию по их заверщению
 * @param sources - массив(объект) изображений
 * @param callback - вызываемая функция
 */
function loadImages(sources, callback){
	var loadedImages = 0;
	var numImages = 0;
	for (var src in sources) {
		numImages++;
	}
	for (var src in sources) {
		images[src] = new Image();
		images[src].onload = function(){
			if (++loadedImages >= numImages) {
				callback();
			}
		};
		images[src].src = sources[src];
	}
}

/**
 * Инициализация шашек
 * Инициализирует контекст, события мыши/пальца, расставляет шашки, начинает новую игру
 */
function init() {
	canvas = document.getElementById("canv");

	if (canvas.getContext) {
		
		context = canvas.getContext('2d');
		
		canvas.onmousedown = onStart;
		canvas.onmousemove = onMove;
		canvas.onmouseup = onStop;
		
		canvas.ontouchstart = onStart;
		canvas.ontouchend = onStop;
		canvas.ontouchmove = onMove; 

        log = new Logger('log_info');
        
		newGame();
		refresh();
        log.add('Начата новая игра');
        log.add('Ход белых');
	}
}

/**
 * Начинает новую игру, присваивает координаты шашкам
 */
function newGame() {
	pieces = [
		new Cell(0, 5, 'white'), new Cell(2, 5, 'white'),
		new Cell(4, 5, 'white'), new Cell(6, 5, 'white'),
		new Cell(1, 6, 'white'), new Cell(3, 6, 'white'),
		new Cell(5, 6, 'white'), new Cell(7, 6, 'white'),
		new Cell(0, 7, 'white'), new Cell(2, 7, 'white'),
		new Cell(4, 7, 'white'), new Cell(6, 7, 'white'),

		new Cell(1, 0, 'black'), new Cell(3, 0, 'black'),
		new Cell(5, 0, 'black'), new Cell(7, 0, 'black'),
		new Cell(0, 1, 'black'), new Cell(2, 1, 'black'),
		new Cell(4, 1, 'black'), new Cell(6, 1, 'black'),
		new Cell(1, 2, 'black'), new Cell(3, 2, 'black'),
		new Cell(5, 2, 'black'), new Cell(7, 2, 'black')];
	
	whiteTurn = true;
	mustBeat = 0;
}

function newMyGame() {
	pieces = [
		new Cell(2, 1, 'white', true), /*new Cell(2, 5, 'white'),
		new Cell(4, 5, 'white'), new Cell(0, 5, 'white'),
		/*new Cell(6, 1, 'white'), new Cell(6, 3, 'white'),
		new Cell(6, 5, 'white'), new Cell(6, 7, 'white'),
		new Cell(7, 0, 'white'), new Cell(7, 2, 'white'),
		new Cell(7, 4, 'white'), new Cell(7, 6, 'white'),*/

		/*new Cell(0, 1, 'black'), new Cell(0, 3, 'black'),
		new Cell(0, 5, 'black'), new Cell(0, 7, 'black'),
		new Cell(1, 0, 'black'), new Cell(1, 2, 'black'),
		new Cell(1, 4, 'black'), new Cell(1, 6, 'black'),*/
		new Cell(3, 2, 'black'), new Cell(5, 4, 'black'),
		new Cell(2, 5, 'black'), new Cell(5, 6, 'black')];
	
	whiteTurn = true;
	mustBeat = 0;
}

/**
 * Процедура перерисовки поля.
 * Перерисовывает поле, шашки, рисует номера клеток
 */
function refresh() {

	if (whiteTurn) {
		$('#info .turn').text('WHITE');
	} else {
		$('#info .turn').text('BLACK');
	}
    
	context.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
	drawBoard();
	drawPieces();
    drawNumbers();
}

/**
 * Рисует номера клеток
 */
function drawNumbers() {
    context.fillStyle = "#555";
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            context.fillText('[' + j + ';' + i + ']', j * CELL_SIZE + 30, i * CELL_SIZE + 45);
        }
    }
}

/**
 * Рисует все шашки на доске
 */
function drawPieces() {
	for (i in pieces) {
		drawPiece(pieces[i]);
	}
}

/**
 * Рисует доску
 */
function drawBoard(){
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            if (i % 2 != j % 2) {
                context.fillStyle = COLOR_BLACK;
            } else {
                context.fillStyle = COLOR_WHITE;
            }
            context.fillRect(j * CELL_SIZE, i * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
	context.beginPath();
	for (var x = 0.5; x < BOARD_SIZE; x += CELL_SIZE) {
		context.moveTo(x, 0);
		context.lineTo(x, BOARD_SIZE);
	}
	for (var y = 0.5; y < BOARD_SIZE; y += CELL_SIZE) {
		context.moveTo(0, y);
		context.lineTo(BOARD_SIZE, y);
	}
	context.strokeStyle = "#ccc";
	context.stroke();
}

/**
 * Рисует указанную шашку на своём месте на поле
 * @param cell - объект шашки, содержит инфу о КООРДИНАТАХ, о ЦВЕТЕ, о ДАМКЕ, о ВЫДЕЛЕННОЙ шашке
 */
function drawPiece(cell){
    if (! cell.isActive) {
        return;
    }
    
	x = cell.x;
	y = cell.y;
	
	px = CELL_SIZE * x;
	py = CELL_SIZE * y;
	
	if (cell.isSelected) {
        // если шашка выделена

		if (touching) {
		    // шашку двигаем, значит на поле её не рисуем
		} else {
            // шашку просто выделели, рисуем на её же месте обведённую
            cell.isKing ?  drawKingPieceatXY(cell.isWhite, px, py) : drawPieceatXY(cell.isWhite, px, py);
            selectPieceatXY(px, py);
        }
	} else {
		// рисуем обычную шашки
		cell.isKing ?  drawKingPieceatXY(cell.isWhite, px, py) : drawPieceatXY(cell.isWhite, px, py);
	}
}

/**
 * Рисует шашку в указанных координатах
 * @param cell - объект шашки, содержит инфу о ЦВЕТЕ, о ДАМКЕ, о ВЫДЕЛЕННОЙ шашке
 * @param x - X координата верхнего левого угла клетки в пикселах
 * @param y - Y координата верхнего левого угла клетки в пикселах
 */
function drawPieceXY(cell, x, y){
	px = x ? x : 0;
	py = y ? y : 0;
	
    cell.isKing ?  drawKingPieceatXY(cell.isWhite, px, py) : drawPieceatXY(cell.isWhite, px, py);

	if (cell.isSelected) {
		// обводим шашку
        selectPieceatXY(px, py);
	}
}

/**
 * Рисует ДАМКУ в указанных координатах
 * @param isWhite - цвет дамки (true, false) - черная, белая
 * @param x - X координата верхнего левого угла клетки в пикселах
 * @param y - Y координата верхнего левого угла клетки в пикселах
 */
function drawKingPieceatXY(isWhite, x, y){
	px = x ? x : 0;
	py = y ? y : 0;

    drawPieceatXY(isWhite, px, py);

    r = CELL_SIZE / 2;

    context.strokeStyle = '#ffff00';

    context.beginPath();
    context.lineWidth = 10;
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, 20, 0, Math.PI * 2, false);
    context.closePath();
    context.stroke();

    context.strokeStyle = 'black';

    context.lineWidth = 1;
}

/**
 * Рисует фишку в указанных координатах
 * @param isWhite - цвет шашки (true, false) - черная, белая
 * @param x - X координата верхнего левого угла клетки в пикселах
 * @param y - Y координата верхнего левого угла клетки в пикселах
 */
function drawPieceatXY(isWhite, x, y){
	px = x ? x : 0;
	py = y ? y : 0;

	color = isWhite ? '#00ff00' : '#5786cf';

    // обводим шашку
    r = CELL_SIZE / 2;

    context.strokeStyle = 'black';

    context.beginPath();
    context.lineWidth = 4;
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r-14, 0, Math.PI * 2, false);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.lineWidth = 2;
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r-2, 0, Math.PI * 2, false);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.lineWidth = 10;
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r-8, 0, Math.PI * 2, false);
    context.strokeStyle = color;
    context.closePath();
    context.stroke();

    context.lineWidth = 1;
}

/**
 * Обводит фишку как текущую
 * @param px - X координата верхнего левого угла клетки в пикселах
 * @param py - Y координата верхнего левого угла клетки в пикселах
 */
function selectPieceatXY(px, py) {
    context.beginPath();
    r = CELL_SIZE / 2 - 1;
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r++, 0, Math.PI * 2, false);
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r++, 0, Math.PI * 2, false);
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r++, 0, Math.PI * 2, false);
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r++, 0, Math.PI * 2, false);
    context.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, r++, 0, Math.PI * 2, false);
    context.closePath();
    context.strokeStyle = SELECTION_COLOR;
    context.stroke();
}


/**
 * Показывает возможные ходы шашки на поле
 * @param currentMoves - структура дерево ходов шашки
 */
function getRecMoves (currentMoves) {
    if (currentMoves && currentMoves.length > 0) {
        for (k in currentMoves) {

            if (currentMoves[k].moves.length > 0) {
                // двигаемся по ветке ходов
                getRecMoves(currentMoves[k].moves);
            } else {
                // остановились на листе, раскрашиваем его
                fillAvaibleMove(currentMoves[k].x, currentMoves[k].y)
            }
        }
    }
}

/**
 * Подсвечивает указанное поле как доступное для хода
 * @param x - координата по оси абсцисс [0;7]
 * @param y - координата по оси ординат [0;7]
 */
function fillAvaibleMove(x, y) {
    context.beginPath();
    context.strokeStyle = "yellow";
    context.lineWidth = 4;
    context.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2, 0, Math.PI * 2, true);
    context.stroke();
    context.lineWidth = 1;
}

/**
 * Рисует линию, соединяющую 2 ячейки
 * @param p1
 * @param p2
 */
function drawPathLine(p1, p2) {
    context.beginPath();
    context.strokeStyle = "#56C3D1";
    
    context.arc((p1.x + 0.5) * CELL_SIZE, (p1.y + 0.5) * CELL_SIZE, 4, 0, Math.PI * 2, true);

    context.lineWidth = 4;
    context.moveTo((p1.x + 0.5) * CELL_SIZE, (p1.y + 0.5) * CELL_SIZE);
    context.lineTo((p2.x + 0.5) * CELL_SIZE, (p2.y + 0.5) * CELL_SIZE);

    context.stroke();
    context.lineWidth = 1;
}