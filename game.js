var canvas = null;
var context = null;
var cb_lastPoints = [];
var CELL_SIZE = 80;
var BOARD_SIZE = CELL_SIZE * 8;
var COLOR_BLACK = '#ededed';
var COLOR_WHITE = '#fff';
var SELECTION_COLOR = '#c0c';
var touching = false; // флаг определяющий нажатие мыши/пальца во время перемещения
var images = {};
var diff_coords = {};
var last_coords = {}; // последние координаты

var movesMap = []; // рассчитываемые возможные ходы шашки
var pieceRoutes = {}; // рассчитываемый маршрут шашек при непосредственно ходе
var pieceRoutesPointer = 0; // указатель на текущий список маршрутов

var whiteTurn = true; // флаг определяющий ход
var mustBeat = false; // флаг определяющий, должен ли бить игрок. Определяется после каждого хода
var countBeatenPiecesArr = {};
var log = null; // объект для логирования сообщений
var pieces; // сами шашки
var directions = ['NE', 'SE', 'SW', 'NW']; // диагонали направления 

var isSelected = -1;

var new_x, new_y;

/**
 * Объект шашка 
 */
var Cell = function(x, y, kind, isKing) {
	this.x = x;
	this.y = y;
	this.isKing = isKing ? isKing : false;
	this.isSelected = false;
	this.isWhite = kind == 'black' ? false : true;
	this.isBlack = kind == 'black' ? true : false;
    this.isActive = true;
    this.moves = {};
};

/**
 * Объект логгер для ведения логов
 */
var Logger = function(output_id) {
    this.output = document.getElementById(output_id);

    /**
     * Добавляет текст в окно вывода
     * @param text
     */
    this.add = function(text) {
        this.output.innerHTML +=  text + '<br />';
        this.output.scrollTop = this.output.scrollHeight;
    }
	this.clear = function() {
		this.output.innerHTML = '';
	}
}



/**
 * Событие при нажатии на поле мышью или пальцем
 * @param e - событие браузера
 */
function onStart(e) {
	if (e.touches) {
		// координаты пальца
		coords = getCoords(e.touches[0]);
	} else {
		// координаты мыши
		coords = getCoords(e);
	}
	last_coords = coords;

    // высчитываем координаты относительные и относительно доски попадания мыши или пальца
	diff_coords = {	x : coords.x - Math.floor(coords.x / CELL_SIZE) * CELL_SIZE, 
					y : coords.y - Math.floor(coords.y / CELL_SIZE) * CELL_SIZE};
	diff_board_coords = {	x : Math.floor(coords.x / CELL_SIZE), 
							y : Math.floor(coords.y / CELL_SIZE)};

	// проверка на попадание в окружность шашки
	if (isHitChecker(diff_coords.x, diff_coords.y)) {
		
		// получаем выбранную шашку
		for (p in pieces) {

            // убираем выделение с других остальных шашек
			if (pieces[p].isSelected) {
				pieces[p].isSelected = false;
			}
            
			if (pieces[p].x == diff_board_coords.x && pieces[p].y == diff_board_coords.y
                && (whiteTurn == pieces[p].isWhite) && pieces[p].isActive)
            {
                // если совпали координаты мыши и шашки и нужный ход
                // шашка становится выделенной
                
				isSelected = p;
				pieces[isSelected].isSelected = true;

                // получаем доступные ходы для шашки
                // TODO: заменить передачу координат на передачу объекта ШАШКА
				if (pieces[isSelected].isKing) {
					log.add('Ход дамки ['+ pieces[isSelected].x +';'+ pieces[isSelected].y +']');
					pieces[isSelected].moves = getKingmovesMap({x : pieces[isSelected].x, y : pieces[isSelected].y, isWhite: pieces[isSelected].isWhite});
				} else {
					pieces[isSelected].moves = getPiecemovesMap({x : pieces[isSelected].x, y : pieces[isSelected].y, isWhite: pieces[isSelected].isWhite});
				}

                // рисуем доступные ходы
                getRecMoves(pieces[isSelected].moves);
			}
		}
		
		touching = true;
	} else {
        /*
        // убираем выделение с других шашек
        if (pieces[i].isSelected) {
            pieces[i].isSelected = false;
        }
        */
    }

    //drawNewPieceXY(coords.x - diff_coords.x, coords.y - diff_coords.y);

	return false;
}

/**
 * Событие при отпускании фишки мышью или пальцем
 * @param e - событие браузера
 */
function onStop(e) {
	e.preventDefault();

    // если до этого было перетаскивание фишки
	if (touching) {
		touching = false;

        // если была выбрана фишка
		if (isSelected >=0 ) {

            // получаем новые координаты на доске в месте отпускания фишки
            new_x = Math.ceil(last_coords.x / CELL_SIZE) - 1;
            if (new_x > 7) new_x = 7;
			if (new_x < 0) new_x = 0;
			
			new_y = Math.ceil(last_coords.y / CELL_SIZE) - 1;
			if (new_y > 7) new_y = 7;
			if (new_y < 0) new_y = 0;

			// переместили шашку, координаты различаются
			if (pieces[isSelected].x != new_x || pieces[isSelected].y != new_y) {

                // формируем маршруты pieceRoutes
                pieceRoutes = {};
                pieceRoutesPointer = 0;
                canPieceMove(pieces[isSelected].moves, new_x, new_y)

                // ищем маршрут до нужной точки, при котором получается взять наибольшее количество шашек
                currentRouteId = getMaxPieceRoute(pieceRoutes);

                if (currentRouteId >= 0) {
                    // если таки мы можем перейти в новое место

                    // обязаны ли мы бить?
                    if (mustBeat > 0) {
                        if (countBeatenPiecesArr[currentRouteId] == 0) {
                            log.add("Недопустимый ход, Вы обязаны бить!");
                            refresh();
                            return false;
                        }
                    }

                    // удаляет взятые шашки с доски
                    removeBeatenPieces(pieces[isSelected].moves, pieceRoutes[currentRouteId], 0, new_x, new_y);

                    // все ништяк, меняем координаты шашки
                    pieces[isSelected].x = new_x;
                    pieces[isSelected].y = new_y;

                    // снимаем выделение, проверяем на дамку
                    pieces[isSelected].isSelected = false;
                    pieces[isSelected].isKing = isKing(pieces[isSelected]);
                    isSelected = -1;

					// Победа какого-либо игрока
					if (victory = checkVictory()) {
						log.add('Победа ' + (victory == 'white' ? 'белых' : 'черных') + '!');
						
						if (confirm('Начать заново?')) {
							newGame();
							refresh();
							log.clear();
							log.add('Начата новая игра');
							log.add('Ход белых');							
							return;
						} else {
							refresh();
							return;
						}
					}

                    // меняем ход
                    whiteTurn = !whiteTurn;

                    // определяем должен ли бить следующий игрок
                    mustBeat = isPieceMustBeat(whiteTurn);

                    log.add('Ход ' + (whiteTurn ? 'белых' : 'черных') +
                            ((mustBeat > 0) ? ' (обязаны бить '+ mustBeat +')' : '')
                    );

                }
			}

			refresh();
		}
	}
	return false;
}

/**
 * Событие, вызываемое при перемещении мыши или пальца
 * @param e - событие браузера
 */
function onMove(e) {
	if (e.touches) {
        // координаты пальца
		coords = getCoords(e.touches[0]);
	} else {
        // координаты мыши
		coords = getCoords(e);
	}

    // обновляем переменную с последними координатами мыши
	last_coords = coords;

    // отображаем информацию о курсоре
	$('#info .x').text('X: ' + coords.x); $('#info .cx').text('CX: ' + Math.ceil(coords.x / CELL_SIZE - 1));
	$('#info .y').text('Y: ' + coords.y); $('#info .cy').text('CY: ' + Math.ceil(coords.y / CELL_SIZE - 1));

	if (touching) {
        // при нажатой мыши (перемещению пальцем)

        // получаем координаты рисования перемещаемой шашки
		checker_coords = {	x : coords.x - diff_coords.x,
							y : coords.y - diff_coords.y};

        // перерисовываем доску
		refresh();

		if (isSelected >= 0) {
            // получаем новые координаты на доске в месте отпускания фишки
            new_x = Math.ceil(last_coords.x / CELL_SIZE) - 1;
            if (new_x > 7) new_x = 7;
            if (new_x < 0) new_x = 0;

            new_y = Math.ceil(last_coords.y / CELL_SIZE) - 1;
            if (new_y > 7) new_y = 7;
            if (new_y < 0) new_y = 0;

            if (pieces[isSelected].x != new_x || pieces[isSelected].y != new_y) {
                // формируем маршруты pieceRoutes
                pieceRoutes = {};
                pieceRoutesPointer = 0;
                canPieceMove(pieces[isSelected].moves, new_x, new_y)

                currentRouteId = getMaxPieceRoute(pieceRoutes);
                if (currentRouteId >= 0) {
                    // рисуем путь до нужной клетки
                    drawPieceRoute(pieces[isSelected], pieceRoutes[currentRouteId]);
                    drawPieces();
                }

            }

            // рисуем перемещаемую шашку там где курсор
            pieces[isSelected].isSelected = true;
			drawPieceXY(pieces[isSelected], checker_coords.x, checker_coords.y);
		}

	}

	return false;
}

/**
 * Проверяет может ли фишка переместиться по указанному дереву пути в нужные координаты
 * попутно формирую массив-путь шашки
 * @param currentMoves - рассчитанная структура-"дерево" пути, содержащее все возможные ходы и взятия
 * @param x - координата X куда нужно прийти [0;7]
 * @param y - координата Y куда нужно прийти [0;7]
 */
function canPieceMove(currentMoves, x, y) {
    if (currentMoves && currentMoves.length > 0) {
        for (k in currentMoves) {

            var isFound = false;

            if (!pieceRoutes[pieceRoutesPointer]) {
                pieceRoutes[pieceRoutesPointer] = [];
            }

            // формируем маршрут
            pieceRoutes[pieceRoutesPointer].push({x: currentMoves[k].x, y: currentMoves[k].y});

            if (currentMoves[k].moves.length > 0) {
                // можем двигаться дальше по ветке
                if (canPieceMove(currentMoves[k].moves, x, y)) {
					return true;
				}
            } else {
                // крайний лист дерева
                if (currentMoves[k].x == x && currentMoves[k].y == y) {
                    // если координаты совпали то УРА

                    pieceRoutesPointer++;
                    pieceRoutes[pieceRoutesPointer] = pieceRoutes[pieceRoutesPointer - 1].slice(0);

                    isFound = true;
                }

            }

            pieceRoutes[pieceRoutesPointer].pop();
        }
    }
    return false;
}

/**
 * Убирает побитые фишки
 * @param currentMoves - рекурсивный массив из ходов
 * @param currentPath - текущий ПРОСЧИТАННЫЙ путь шашки
 * @param x - новая X координата
 * @param y - новая Y координата
 */
function removeBeatenPieces(currentMoves, currentPath, currentPathPosition, x, y) {
    if (currentMoves && currentMoves.length > 0) {
        for (k in currentMoves) {
            if (currentMoves[k].x == currentPath[currentPathPosition].x
             && currentMoves[k].y == currentPath[currentPathPosition].y)
            {
                // проверка на то, что текущая координата из возможных координат
                // лежит на маршруте движения фишки

                if (currentMoves[k].beat) {
                    // бьём фишку на пути
                    piece_key = getPieceIndexAt(currentMoves[k].beat.x, currentMoves[k].beat.y);
                    if (piece_key != null) {
						pieces[piece_key].isActive = false;
					}
                }
                if (currentMoves[k].moves.length > 0) {
                    // можем ли мы идти дальше?
                    return removeBeatenPieces(currentMoves[k].moves, currentPath, ++currentPathPosition, x, y);
                }
            } else {
                continue;
            }
        }
    }
}

/**
 * Считает количество взятых фишек на данном маршруте
 * @param currentMoves - рекурсивный массив из ходов
 * @param currentPath - текущий ПРОСЧИТАННЫЙ путь шашки
 * @param x - новая X координата
 * @param y - новая Y координата
 */
var beaten_sum = 0;
function countBeatenPieces(currentMoves, currentPath, currentPathPosition, x, y) {
    if (currentMoves && currentMoves.length > 0) {
        for (k in currentMoves) {
            if (currentMoves[k].x == currentPath[currentPathPosition].x
             && currentMoves[k].y == currentPath[currentPathPosition].y)
            {
                // проверка на то, что текущая координата из возможных координат
                // лежит на маршруте движения фишки

                if (currentMoves[k].beat) {
                    // бьём фишку на пути
                    piece_key = getPieceIndexAt(currentMoves[k].beat.x, currentMoves[k].beat.y);
                    if (piece_key != null) {
						beaten_sum++;
					}
                }
                if (currentMoves[k].moves.length > 0) {
                    // можем ли мы идти дальше?
                    countBeatenPieces(currentMoves[k].moves, currentPath, ++currentPathPosition, x, y);
                }
            } else {
                continue;
            }
        }
    }
}

/**
 * Возвращает номер шашки в массиве по координатам или null если шашка не найдена
 * @param x - координата по оси абсцисс [0;7]
 * @param y - координата по оси ординат [0;7]
 */
function getPieceIndexAt(x, y) {
    for (i in pieces) {
        if (pieces[i].x == x && pieces[i].y == y && pieces[i].isActive) {
            return i;
        }
    }
    return null;
}

/**
 * Проверяет, может ли бить шашка/дамка в указанном направлении
 * @return TRUE | FALSE
 */
function canBeatAtDirection(cell, direction) {
	if (cell.isKing) {
		// проверка для дамки
		
		mustGoOn = true;
		
		switch (direction) {
			case 'NE':
				for (kx = cell.x + 1, ky = cell.y - 1; mustGoOn ; kx++, ky--) {
					if (!isValidCell(kx, ky)) {
						// об стенку
						return false;
					}

					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
						// об свою фишку
						return false;
					}

					// нашли фишку врага на пути
					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')) 
					{
						// ищем свободное место куда встать
						if (isValidCell(kx + 1, ky - 1) && ! isPieceHere(kx + 1, ky - 1)) {
							return true;
						} else {
							return false;
						}
					}
				}

				break;
			case 'SE':
				for (kx = cell.x + 1, ky = cell.y + 1; mustGoOn ; kx++, ky++) {
					if (!isValidCell(kx, ky)) {
						// об стенку
						return false;
					}

					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
						// об свою фишку
						return false;
					}

					// нашли фишку врага на пути
					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')) 
					{
						// ищем свободное место куда встать
						if (isValidCell(kx + 1, ky + 1) && ! isPieceHere(kx + 1, ky + 1)) {
							return true;
						} else {
							return false;
						}
					}
				}
				break;
			case 'SW':
				for (kx = cell.x - 1, ky = cell.y + 1; mustGoOn ; kx--, ky++) {
					if (!isValidCell(kx, ky)) {
						// об стенку
						return false;
					}

					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
						// об свою фишку
						return false;
					}

					// нашли фишку врага на пути
					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')) 
					{
						// ищем свободное место куда встать
						if (isValidCell(kx - 1, ky + 1) && ! isPieceHere(kx - 1, ky + 1)) {
							return true;
						} else {
							return false;
						}
					}
				}
				break;
			case 'NW':
				for (kx = cell.x - 1, ky = cell.y - 1; mustGoOn ; kx--, ky--) {
					if (!isValidCell(kx, ky)) {
						// об стенку
						return false;
					}

					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
						// об свою фишку
						return false;
					}

					// нашли фишку врага на пути
					if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')) 
					{
						// ищем свободное место куда встать
						if (isValidCell(kx - 1, ky - 1) && ! isPieceHere(kx - 1, ky - 1)) {
							return true;
						} else {
							return false;
						}
					}
				}
				break;
		}		
	} else {
		// проверка для обычный шашки
		switch (direction) {
			case 'NE':
				if (isValidCell(cell.x + 2, cell.y - 2) && ! isPieceHere(cell.x + 2, cell.y - 2)
					&& isPieceHere(cell.x + 1, cell.y - 1) == (cell.isWhite ? 'black' : 'white')) {
					return true;
				} else {
					return false;
				}
				break;
			case 'SE':
				if (isValidCell(cell.x + 2, cell.y + 2) && ! isPieceHere(cell.x + 2, cell.y + 2)
					&& isPieceHere(cell.x + 1, cell.y + 1) == (cell.isWhite ? 'black' : 'white')) {
					return true;
				} else {
					return false;
				}
				break;
			case 'SW':
				if (isValidCell(cell.x - 2, cell.y + 2) && ! isPieceHere(cell.x - 2, cell.y + 2)
					&& isPieceHere(cell.x - 1, cell.y + 1) == (cell.isWhite ? 'black' : 'white')) {
					return true;
				} else {
					return false;
				}
				break;
			case 'NW':
				if (isValidCell(cell.x - 2, cell.y - 2) && ! isPieceHere(cell.x - 2, cell.y - 2)
					&& isPieceHere(cell.x - 1, cell.y - 1) == (cell.isWhite ? 'black' : 'white')) {
					return true;
				} else {
					return false;
				}
				break;
		}
	}
}

/**
 * Определяет должен ли бить игрок (находятся ли чужие фишки под боем)
 * @param whiteCells - TRUE|FALSE - белые или черные шашки
 */
function isPieceMustBeat(whiteCells) {
    result = 0;
	
    for (k in pieces) {

        if (pieces[k].isActive == false) {
            continue;
        }
        // если цвет текущей шашки отличается от нужного нам цвета то идём дальше
        if (pieces[k].isWhite != whiteCells) {
            continue;
        }
		
		// для каждого направления проверяем
		for (dir in directions) {
			if (canBeatAtDirection(pieces[k], directions[dir])) {
				result++;
			}
		}
    }

    return result;
}

/**
 * Рассчитывает все возможные ходы и взятия для указанной шашки
 * @param cell - объект шашка
 */
function getPiecemovesMap(cell) {

    // возможные клетки для перемещения на текущем "прыге"
    var thisTurnMoves = [];

    // Нету предыдущей клетки, откуда прыгали, поэтому проверка обычных ходов без взятия
    if (! cell.parent_x && ! cell.parent_y) {
        if (cell.isWhite) {
            // NE
            if (isValidCell(cell.x + 1, cell.y - 1) && ! isPieceHere(cell.x + 1, cell.y - 1)) {
                thisTurnMoves.push({
                    x: cell.x + 1,
                    y: cell.y - 1,
                    moves:[]
                });
            }
            // NW
            if (isValidCell(cell.x - 1, cell.y - 1) && ! isPieceHere(cell.x - 1, cell.y - 1)) {
                thisTurnMoves.push({
                    x: cell.x - 1,
                    y: cell.y - 1,
                    moves:[]
                });
            }
        } else {
            // SE
            if (isValidCell(cell.x + 1, cell.y + 1) && ! isPieceHere(cell.x + 1, cell.y + 1)) {
                thisTurnMoves.push({
                    x: cell.x + 1,
                    y: cell.y + 1,
                    moves:[]
                });            
			}
            // SW
            if (isValidCell(cell.x - 1, cell.y + 1) && ! isPieceHere(cell.x - 1, cell.y + 1)) {
                thisTurnMoves.push({
                    x: cell.x - 1,
                    y: cell.y + 1,
                    moves:[]
                });
            }
        }
    }

    // взятие NE
    if (cell.y >= 2 && cell.x <= 5
        && (cell.x + 2 != cell.parent_x
			|| cell.y - 2 != cell.parent_y)
        && ((isPieceHere(cell.x + 1, cell.y - 1) == 'black' && cell.isWhite)
            || (isPieceHere(cell.x + 1, cell.y - 1) == 'white' && ! cell.isWhite))
        && ! isPieceHere(cell.x + 2, cell.y - 2))
    {
        var pMove = {
            x: cell.x + 2,
            y: cell.y - 2,
            moves:[],
            beat: {
                x: cell.x + 1,
                y: cell.y - 1
            }
        };
        thisTurnMoves.push(pMove);
    }
    // взятие SE
    if (cell.y <= 5 && cell.x <= 5
        && (cell.x + 2 != cell.parent_x
            || cell.y + 2 != cell.parent_y)
        && ((isPieceHere(cell.x + 1, cell.y + 1) == 'black' && cell.isWhite)
            || (isPieceHere(cell.x + 1, cell.y + 1) == 'white' && ! cell.isWhite))
        && ! isPieceHere(cell.x + 2, cell.y + 2))
    {
        var pMove = {
            x: cell.x + 2,
            y: cell.y + 2,
            moves:[],
            beat: {
                x: cell.x + 1,
                y: cell.y + 1
            }
        };
        thisTurnMoves.push(pMove);
    }
    // взятие SW
    if (cell.y <= 5 && cell.x >= 2
        && (cell.x - 2 != cell.parent_x
            || cell.y + 2 != cell.parent_y)
        && ((isPieceHere(cell.x - 1, cell.y + 1) == 'black' && cell.isWhite)
            || (isPieceHere(cell.x - 1, cell.y + 1) == 'white' && ! cell.isWhite))
        && ! isPieceHere(cell.x - 2, cell.y + 2))
    {
        var pMove = {
            x: cell.x - 2,
            y: cell.y + 2,
            moves:[],
            beat: {
                x: cell.x - 1,
                y: cell.y + 1
            }
        };
        thisTurnMoves.push(pMove);
    }
    // взятие NW
    if (cell.y >= 2 && cell.x >= 2
        && (cell.x - 2 != cell.parent_x
            || cell.y - 2 != cell.parent_y)
        && ((isPieceHere(cell.x - 1, cell.y - 1) == 'black' && cell.isWhite)
            || (isPieceHere(cell.x - 1, cell.y - 1) == 'white' && ! cell.isWhite))
        && ! isPieceHere(cell.x - 2, cell.y - 2))
    {
        var pMove = {
            x: cell.x - 2,
            y: cell.y - 2,
            moves:[],
            beat: {
                x: cell.x - 1,
                y: cell.y - 1
            }
        };
        thisTurnMoves.push(pMove);
    }

    for (i in thisTurnMoves) {
        if (thisTurnMoves[i].beat) {
            thisTurnMoves[i].moves = getPiecemovesMap({
                x: thisTurnMoves[i].x,
                y: thisTurnMoves[i].y,
                isWhite: cell.isWhite,
                parent_x : cell.x,
                parent_y: cell.y
            });
        }
    }
    return thisTurnMoves;
}

/**
 * Рассчитывает все возможные ходы и взятия для указанной ДАМКА
 * @param cell - объект шашка (ДАМКА)
 */
function getKingmovesMap(cell) {

    // возможные клетки для перемещения на текущем "прыге"
    var thisTurnMoves = [];

    // Нету предыдущей клетки, откуда прыгали, поэтому проверка обычных ходов без взятия
	// для дамки проверяем сразу диагонали
	if (! cell.parent_x && ! cell.parent_y) {
		// NE
		for (kx = cell.x + 1, ky = cell.y - 1; true ; kx++, ky--) {
			if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
				thisTurnMoves.push({
					x: kx,
					y: ky,
					moves:[]
				});
			} else {
				break;
			}
		}
		// SE
		for (kx = cell.x + 1, ky = cell.y + 1; true ; kx++, ky++) {
			if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
				thisTurnMoves.push({
					x: kx,
					y: ky,
					moves:[]
				});
			} else {
				break;
			}
		}	
		// SW
		for (kx = cell.x - 1, ky = cell.y + 1; true ; kx--, ky++) {
			if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
				thisTurnMoves.push({
					x: kx,
					y: ky,
					moves:[]
				});
			} else {
				break;
			}
		}	
		// NW
		for (kx = cell.x - 1, ky = cell.y - 1; true ; kx--, ky--) {
			if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
				thisTurnMoves.push({
					x: kx,
					y: ky,
					moves:[]
				});
			} else {
				break;
			}
		}			
		
    }

	// Взятия

	// SE
	mustGoOn = true;
	for (kx = cell.x + 1, ky = cell.y + 1; mustGoOn ; kx++, ky++) {
		if (!isValidCell(kx, ky)) {
			// останавливаемся об стенку
			mustGoOn = false;
			break;				
		}

		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
			// останавливаемся об свою фишку
			mustGoOn = false;
			break;
		}

		// нашли фишку врага на пути
		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white') 
			&& (!cell.parent_direction || cell.parent_direction != 'SE') ) 
		{
			for (nx = kx + 1, ny = ky + 1; mustGoOn ; nx++, ny++) {
				if (isValidCell(nx, ny) && ! isPieceHere(nx, ny)) {
					thisTurnMoves.push({
						x: nx,
						y: ny,
						moves:[],
						beat: {
							x: kx,
							y: ky
						}							
					});
				} else {
					mustGoOn = false;
					break;
				}					
			}

		}
	}


	// SW
	mustGoOn = true;
	for (kx = cell.x - 1, ky = cell.y + 1; mustGoOn ; kx--, ky++) {
		if (!isValidCell(kx, ky)) {
			// останавливаемся об стенку
			mustGoOn = false;
			break;				
		}

		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
			// останавливаемся об свою фишку
			mustGoOn = false;
			break;
		}

		// нашли фишку врага на пути
		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')
			&& (!cell.parent_direction || cell.parent_direction != 'SW') ) 
		{
			for (nx = kx - 1, ny = ky + 1; mustGoOn ; nx--, ny++) {
				if (isValidCell(nx, ny) && ! isPieceHere(nx, ny)) {
					thisTurnMoves.push({
						x: nx,
						y: ny,
						moves:[],
						beat: {
							x: kx,
							y: ky
						}							
					});
				} else {
					mustGoOn = false;
					break;
				}					
			}

		}
	}


	// NW
	mustGoOn = true;
	for (kx = cell.x - 1, ky = cell.y - 1; mustGoOn ; kx--, ky--) {
		if (!isValidCell(kx, ky)) {
			// останавливаемся об стенку
			mustGoOn = false;
			break;				
		}

		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
			// останавливаемся об свою фишку
			mustGoOn = false;
			break;
		}

		// нашли фишку врага на пути
		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')
			&& (!cell.parent_direction || cell.parent_direction != 'NW') )  
		{
			for (nx = kx - 1, ny = ky - 1; mustGoOn ; nx--, ny--) {
				if (isValidCell(nx, ny) && ! isPieceHere(nx, ny)) {
					thisTurnMoves.push({
						x: nx,
						y: ny,
						moves:[],
						beat: {
							x: kx,
							y: ky
						}							
					});
				} else {
					mustGoOn = false;
					break;
				}					
			}

		}
	}


	// NE
	mustGoOn = true;
	for (kx = cell.x + 1, ky = cell.y - 1; mustGoOn ; kx++, ky--) {
		if (!isValidCell(kx, ky)) {
			// останавливаемся об стенку
			mustGoOn = false;
			break;				
		}

		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
			// останавливаемся об свою фишку
			mustGoOn = false;
			break;
		}

		// нашли фишку врага на пути
		if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white')
			&& (!cell.parent_direction || cell.parent_direction != 'NE') ) 
		{
			for (nx = kx + 1, ny = ky - 1; mustGoOn ; nx++, ny--) {
				if (isValidCell(nx, ny) && ! isPieceHere(nx, ny)) {
					thisTurnMoves.push({
						x: nx,
						y: ny,
						moves:[],
						beat: {
							x: kx,
							y: ky
						}							
					});
				} else {
					mustGoOn = false;
					break;
				}					
			}

		}
	}

    for (i in thisTurnMoves) {
        if (thisTurnMoves[i].beat) {
            thisTurnMoves[i].moves = getKingmovesMap({
                x: thisTurnMoves[i].x,
                y: thisTurnMoves[i].y,
                isWhite: cell.isWhite,
                parent_x : cell.x,
                parent_y: cell.y,
				parent_direction : getDirection({x: cell.x, y:cell.y}, {x: thisTurnMoves[i].x, y: thisTurnMoves[i].y})
            });
        }
    }
    return thisTurnMoves;
}

/**
 * Возвращает направление между двумя шашками:
 * NE, SE, SW, NW
 * от второй шашке к первой
 */
function getDirection(cell1, cell2) {
	if (cell2.x > cell1.x && cell2.y > cell1.y) return 'NW';
	if (cell2.x < cell1.x && cell2.y > cell1.y) return 'NE';
	if (cell2.x < cell1.x && cell2.y < cell1.y) return 'SE';
	if (cell2.x > cell1.x && cell2.y < cell1.y) return 'SW';
}

/**
 * Определяет является ли шашка дамкой
 * @param cell - объект шашка
 */
function isKing(cell) {
    if (cell.isKing) {
        return true;
    }
    if (cell.isWhite && cell.y == 0) {
        return true;
    }
    if (! cell.isWhite && cell.y == 7) {
        return true;
    }
    return false;

}

/**
 * Рисует линию по двум точкам
 * @param sX - X координата 1-й точки
 * @param sY - Y координата 1-й точки
 * @param eX - X координата 2-й точки
 * @param eY - Y координата 2-й точки
 */
function drawLine(sX, sY, eX, eY) {
	context.moveTo(sX, sY);
	context.lineTo(eX, eY);
	return { x: eX, y: eY };
}

/**
 * Возвращает координаты мыши или пальца относительно доски в пикселях, кроссбраузерно
 * @param e - событие браузера
 */
function getCoords(e) {
	if (e.pageX == null && e.clientX != null ) {
        // IE fix
		var html = document.documentElement
		var body = document.body
	
		e.pageX = e.clientX + (html && html.scrollLeft || body && body.scrollLeft || 0) - (html.clientLeft || 0)
		e.pageY = e.clientY + (html && html.scrollTop || body && body.scrollTop || 0) - (html.clientTop || 0)
	}
	return { x: e.pageX - canvas.offsetLeft, y: e.pageY - canvas.offsetTop };
}

/**
 * Проверяет попадание координат в круг с радиусом CELL_SIZE
 * @param x - координата по оси абсцисс [0;7]
 * @param y - координата по оси ординат [0;7]
 */
function isHitChecker(x, y) {
	return Math.sqrt(Math.pow(x - (CELL_SIZE / 2), 2) + Math.pow(y - (CELL_SIZE / 2), 2)) <= (CELL_SIZE / 2);
}

/**
 * Проверяет указанную клетку на наличие в ней фишки определенного цвета
 * Возвращает 'white' или 'black' при наличии шашки соответствующего цвета
 * или false если клетка пустая или координаты не принадлежат доске
 * @param x - координата по оси абсцисс [0;7]
 * @param y - координата по оси ординат [0;7]
 */
function isPieceHere(x, y) {
    if (! isValidCell(x, y)) {
        return false;
    }
    
    for (i in pieces) {
        if (pieces[i].x == x && pieces[i].y == y && pieces[i].isActive) {
            return pieces[i].isWhite ? 'white' : 'black';
        }
    }
    return false;
}

/**
 * Проверяет координаты на принадлежность доске и возвращает булевское значение
 * @param x - координата по оси абсцисс [0;7]
 * @param y - координата по оси ординат [0;7]
 */
function isValidCell(x, y) {
    return (x >= 0 && x <= 7 && y >= 0 && y <= 7) ? true : false;
}

/**
 * Проверяет количество шашек и определяет победу
 */
function checkVictory() {
	var count_black = count_white = 0;
	
	for (i in pieces) {
		if (pieces[i].isActive) {
			if (pieces[i].isWhite) {
				count_white++;
			} else {
				count_black++;
			}
		}
	}
	
	if (count_black == 0) return 'white';
	if (count_white == 0) return 'black';
	return false;
}

/**
 * Рисуем путь до нужной клетки
 * @param piece
 */
function drawPieceRoute(piece, path) {
    var start_point = {x: piece.x, y: piece.y};

    for (p in path) {
        end_point = {x: path[p].x, y: path[p].y};
        drawPathLine(start_point, end_point);
        start_point = {x: path[p].x, y: path[p].y};
    }
}

/**
 * Осуществляет поиск в массиве возможных путей до нужной точки
 * И возвращает указатель на путь, при котором игрок побьёт наибольшее количество фишек
 * @param currentPieceRoutes
 */
function getMaxPieceRoute(currentPieceRoutes) {
    // подсчитываем количество взятых фишек для каждого маршрута
    countBeatenPiecesArr = {};
    for (p in currentPieceRoutes) {
        if (currentPieceRoutes[p].length) {
            beaten_sum = 0;
            countBeatenPieces(pieces[isSelected].moves, currentPieceRoutes[p], 0, new_x, new_y);
            countBeatenPiecesArr[p] = beaten_sum;
        }
    }

    maxRouteId = -1;
    maxRouteIdPointer = -1;
    for (i in countBeatenPiecesArr) {
        if (countBeatenPiecesArr[i] > maxRouteId) {
            maxRouteId = countBeatenPiecesArr[i];
            maxRouteIdPointer = i;
        }
    }

    return maxRouteIdPointer;
}