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
var myHistory = null; // объект для работы с адресной строкой браузера
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
	this.isWhite = kind == 'white';
	this.isBlack = kind == 'black';
    this.markedAsBeaten = false; // флаг, отвечающий за то, что шашка помечена как битая при составлении маршрута
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
    };
	this.clear = function() {
		this.output.innerHTML = '';
	};
};


/**
 * Осуществляет ход.
 * При этом используется внешний массив шашек pieces а также переменная isSelected, которая определяет выделенную шашку
 * @param old_x - старая Х координата
 * @param old_y - старая Y координата
 * @param new_x - новая X координата
 * @param new_y - новая Y координата
 */
function doTurn(old_x, old_y, new_x, new_y) {
    // формируем маршруты pieceRoutes
    pieceRoutes = {};
    pieceRoutesPointer = 0;
    canPieceMoveInRoutes(pieces[isSelected].moves, new_x, new_y);

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

        // проходится по маршруту и удаляет взятые шашки с доски
        removeBeatenPieces(pieces[isSelected].moves, pieceRoutes[currentRouteId], 0);

        // записываем маршрут движения шашки в шашечной нотации
        literalPath =
            convertXtoLiteral(old_x) + convertYtoLiteral(old_y) +
            getPiecePathLiteral(pieces[isSelected].moves, pieceRoutes[currentRouteId], 0);

        log.add((whiteTurn ? 'Белые&nbsp;&nbsp;&nbsp;' : 'Черные&nbsp;') + literalPath);

        // добавляем информацию о ходе в адресную строку
        myHistory.addTurn(literalPath);

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
                init();
                return;
            } else {
                refresh();
                return;
            }
        }

        if (lockedPieces = checkLockedPieces()) {
            log.add('Победа ' + (lockedPieces == 'white' ? 'черных' : 'белых') + ' ('+ lockedPieces +' locked) !');

            if (confirm('Начать заново?')) {
                init();
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
    }
}


/**
 * Проверяет может ли фишка переместиться по указанному дереву пути в нужные координаты
 * попутно формирую массив-путь шашки
 * @param currentMoves - рассчитанная структура-"дерево" пути, содержащее все возможные ходы и взятия
 * @param x - координата X куда нужно прийти [0;7]
 * @param y - координата Y куда нужно прийти [0;7]
 */
function canPieceMoveInRoutes(currentMoves, x, y) {
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
                if (canPieceMoveInRoutes(currentMoves[k].moves, x, y)) {
					return true;
				}
            } else {
                // крайний лист дерева
                if (currentMoves[k].x == x && currentMoves[k].y == y) {
                    // если координаты совпали то УРА

                    // проверка на то, что может ли дамка остановиться или обязана продолжать бить далее
                    if (! currentMoves[k].mustBeat) {
                        pieceRoutesPointer++;
                        pieceRoutes[pieceRoutesPointer] = pieceRoutes[pieceRoutesPointer - 1].slice(0);

                        isFound = true;
                    }
                }

            }

            pieceRoutes[pieceRoutesPointer].pop();
        }
    }
    return false;
}

/**
 * Проходится по массиву currentMoves в соответствии с указанным маршрутом currentPath и убирает побитые фишки
 * @param currentMoves - рекурсивный массив из ходов
 * @param currentPath - текущий ПРОСЧИТАННЫЙ маршрут шашки
 * @param currentPathPosition - текущий уровень глубины вложенности в currentPath
 */
function removeBeatenPieces(currentMoves, currentPath, currentPathPosition) {
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
                    return removeBeatenPieces(currentMoves[k].moves, currentPath, ++currentPathPosition);
                }
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
function getCountBeatenPieces(currentMoves, currentPath, currentPathPosition, x, y) {
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
                    getCountBeatenPieces(currentMoves[k].moves, currentPath, ++currentPathPosition, x, y);
                }
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
		// =========================== проверка для дамки ===========================

        // проходим по указанной диагонали и проверяем
        for (
            kx = modifyXdirection(cell.x, direction), ky = modifyYdirection(cell.y, direction);
            true;
            kx = modifyXdirection(kx, direction), ky = modifyYdirection(ky, direction) // меняем kx и ky в зависимости от направления
        )
        {
            // прерываемся об стенку
            if (!isValidCell(kx, ky)) {
                return false;
            }

            // прерываемся об свою фишку
            if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
                return false;
            }

            // нашли фишку врага на пути
            if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white'))
            {
                // ищем свободное место куда встать
                if (isValidCell(modifyXdirection(kx, direction), modifyYdirection(ky, direction)) &&
                    ! isPieceHere(modifyXdirection(kx, direction), modifyYdirection(ky, direction))
                )
                {
                    // можем встать сразу за побитой шашкой
                    return true;
                } else {
                    // нельзя встать за побитой шашкой
                    return false;
                }
            }
        }
	} else {
        // =========================== проверка для обычной шашки ===========================

        if (isValidCell(modifyXdirection(cell.x, direction, true), modifyYdirection(cell.y, direction, true)) &&
            ! isPieceHere(modifyXdirection(cell.x, direction, true), modifyYdirection(cell.y, direction, true))
            && isPieceHere(modifyXdirection(cell.x, direction), modifyYdirection(cell.y, direction)) == (cell.isWhite ? 'black' : 'white')
        )
        {
            // можем взять вражескую шашку и поле за ней свободное
            return true;
        } else {
            return false;
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

        if (! pieces[k].isActive) {
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
function getPieceMovesMap(cell) {

    // возможные клетки для перемещения на текущем "прыге"
    var thisTurnMoves = [];

    // Нету предыдущей клетки, откуда прыгали, поэтому проверка обычных ходов без взятия
    if (! cell.parent_x && ! cell.parent_y) {
        if (cell.isWhite) {
            // направления, по которым могут ходить(!) белые(!) шашки
            dirs = ['NE', 'NW'];
        } else {
            // направления, по которым могут ходить(!) черные(!) шашки
            dirs = ['SE', 'SW'];
        }

        // ============================== обычные ходы ==============================

        // в цикле для каждого направления определяем возможность походить на соседнюю клетку
        for (dir in dirs) {
            if (isValidCell(modifyXdirection(cell.x, dirs[dir]), modifyYdirection(cell.y, dirs[dir])) &&
                ! isPieceHere(modifyXdirection(cell.x, dirs[dir]), modifyYdirection(cell.y, dirs[dir]))
            )
            {
                // все условия выполняются, добавляем возможный прыг

                // проверяем все направления - может ли шашка бить в каком-нибудь из них
                mustBeatHere = false;
                for (hereDir in dirs) {
                    if (canBeatAtDirection(cell, dirs[hereDir])) {
                        mustBeatHere = true;
                    }
                }

                if (mustBeatHere) {
                    // обычный прыг шашки нельзя осуществить, т.к. она обязана бить в каком-то из направлений
                    thisTurnMoves.push({
                        x: modifyXdirection(cell.x, dirs[dir]),
                        y: modifyYdirection(cell.y, dirs[dir]),
                        moves:[],
                        mustBeat: true
                    });
                } else {
                    // обычный прыг шашки на одну клетку рядом
                    thisTurnMoves.push({
                        x: modifyXdirection(cell.x, dirs[dir]),
                        y: modifyYdirection(cell.y, dirs[dir]),
                        moves:[]
                    });
                }

                // добавляем прыг

            }
        }
    }

    // ============================== взятия ==============================
    var dir;

    // для каждого направления, куда может бить шашка (как вперёд, так и назад)
    for (dir in directions) {
        if (
           isPieceHere(modifyXdirection(cell.x, directions[dir]), modifyYdirection(cell.y, directions[dir])) == (cell.isWhite ? 'black' : 'white') && // если есть вражеская шашка
           isValidCell(modifyXdirection(cell.x, directions[dir], true), modifyYdirection(cell.y, directions[dir], true)) && // и далее после неё нормальная пустая клетка
           ! isPieceHere(modifyXdirection(cell.x, directions[dir], true), modifyYdirection(cell.y, directions[dir], true)) && // и она пустая
           (modifyXdirection(cell.x, directions[dir], true) != cell.parent_x || modifyYdirection(cell.y, directions[dir], true) != cell.parent_y) // и направление не совпадает с тем, откуда мы пришли
        )
        {
            // добавляем прыг со взятием шашки
            thisTurnMoves.push({
                x: modifyXdirection(cell.x, directions[dir], true), y: modifyYdirection(cell.y, directions[dir], true), // новые координаты клетки куда ходим
                moves: getPieceMovesMap({ // рекурсивный вызов поиска ходов в дочерних ветках
                    x: modifyXdirection(cell.x, directions[dir], true), y: modifyYdirection(cell.y, directions[dir], true),
                    isWhite: cell.isWhite,
                    parent_x : cell.x, parent_y: cell.y
                }),
                beat: {x: modifyXdirection(cell.x, directions[dir]), y: modifyYdirection(cell.y, directions[dir])}
            });
        }
    }

    return thisTurnMoves;
}

/**
 * Рассчитывает все возможные ходы и взятия для указанной ДАМКА
 * @param cell - объект шашка (ДАМКА)
 */
function getKingMovesMap(cell) {

    // возможные клетки для перемещения на текущем ходу
    var thisTurnMoves = [];

    // объявляем переменные, которые используются в качестве переменных цикла в рекурсивных процедурах
    var dir, nx, ny, kx, ky, beatenPieceIndex, mustGoOn, thisTurnCanBeatMore;

    // Нету предыдущей клетки, откуда прыгали, поэтому проверка обычных ходов без взятия
	// для дамки проверяем сразу диагонали
	if (! cell.parent_x && ! cell.parent_y) {

        // Для начальной позиции - еще непобили никакую шашку
        // - поэтому сбрасываем флаг markedAsBeaten
        for (i in pieces) {
            // для каждой шашки на текущем ходу сбрасываем флаг
            pieces[i].markedAsBeaten = false;
        }

        // ============================== обычные ходы ==============================

        // в цикле для каждого направления ищем возможные ходы
        for (dir in directions) {

            // в цикле идём вдоль диагонали
            // и пока можем ходить без взятия на нормальные клетки
            // то добавляем ходыы массив
            for (
                kx = modifyXdirection(cell.x, directions[dir]), ky = modifyYdirection(cell.y, directions[dir]);
                true;
                kx = modifyXdirection(kx, directions[dir]), ky = modifyYdirection(ky, directions[dir]) // меняем kx и ky в зависимости от направления
            )
            {
                // если клетка "не стенка" и там никого нет
                if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
                    // все условия выполняются, добавляем возможный прыг

                    // проверяем все направления - может ли дамка бить в каком-нибудь из них
                    mustBeatHere = false;
                    for (hereDir in directions) {
                        if (canBeatAtDirection(cell, directions[hereDir])) {
                            mustBeatHere = true;
                        }
                    }

                    // добавляем возможный прыг
                    if (mustBeatHere) {
                        // прыг дамки на несколько клеток нельзя осуществить, т.к. она обязана бить
                        thisTurnMoves.push({x: kx, y: ky, moves:[], mustBeat: true});
                    } else {
                        // обычный прыг дамки на несколько клеток
                        thisTurnMoves.push({x: kx, y: ky, moves:[]});
                    }
                } else {
                    break;
                }
            }
        }
    }

	// ============================== взятия ==============================

    // в цикле для каждого направления ищем возможные взятия
    for (dir in directions) {

        mustGoOn = true;

        // цикл вдоль диагонали
        for (
            kx = modifyXdirection(cell.x, directions[dir]), ky = modifyYdirection(cell.y, directions[dir]);
            mustGoOn;
            kx = modifyXdirection(kx, directions[dir]), ky = modifyYdirection(ky, directions[dir]) // меняем kx и ky в зависимости от направления
        )
        {

            // останавливаемся об стенку
            if (!isValidCell(kx, ky)) {
                mustGoOn = false;
                break;
            }

            // останавливаемся об свою фишку
            if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'white' : 'black')) {
                mustGoOn = false;
                break;
            }

            // останавливаемся об уже побитую фишку
            if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white') && pieces[getPieceIndexAt(kx, ky)].markedAsBeaten) {
                mustGoOn = false;
                break;
            }

            // нашли фишку врага на пути
            if (isValidCell(kx, ky) && isPieceHere(kx, ky) == (cell.isWhite ? 'black' : 'white') // если на пути есть фишка и она вражеская
                && (!cell.parent_direction || cell.parent_direction != directions[dir]) ) // и направление - это то, не откуда мы пришли
            {
                // индекс побитой шашки в глобальном массиве pieces
                beatenPieceIndex = getPieceIndexAt(kx, ky);

                // флаг отвечающий за то, что дамка может бить далее, а не останавливаться на месте
                thisTurnCanBeatMore = false;

                // если шашка еще не побитая, то бьём её
                // и записываем все клетки после неё, на которые можно встать после удара
                if (! pieces[beatenPieceIndex].markedAsBeaten) {

                    // идём в цикле по диагонали по клеткам ПОСЛЕ побитой шашки
                    for (
                        nx = modifyXdirection(kx, directions[dir]), ny = modifyYdirection(ky, directions[dir]);
                        mustGoOn;
                        nx = modifyXdirection(nx, directions[dir]), ny = modifyYdirection(ny, directions[dir])
                    )
                    {
                        // если после неё пустое место, то мы можем туда пойти (добавляем прыг)
                        if (isValidCell(nx, ny) && ! isPieceHere(nx, ny)) {
                            // помечаем шашку как битую на этом прыге
                            pieces[beatenPieceIndex].markedAsBeaten = true;

                            // добавляем прыг
                            thisTurnMoves.push({
                                x: nx, y: ny, // координаты места, куда прыгаем
                                moves:getKingMovesMap({ // рекурсивный вызов этой же функции - ищем все дочерние ветки
                                    x: nx, y: ny, // координаты места, куда прыгаем
                                    isWhite: cell.isWhite, // цвет шашки
                                    isKing: cell.isKing, // дамка ли?
                                    parent_x : cell.x, parent_y: cell.y, // координаты предыдущего места, откуда прыгаем
                                    parent_direction : getDirection({x: cell.x, y:cell.y}, {x: nx, y: ny}) // направление движения
                                }),
                                beat: {x: kx, y: ky} // координаты шашки, которую бьём
                            });

                            if (thisTurnMoves[thisTurnMoves.length - 1].moves.length) {
                                thisTurnCanBeatMore = true;
                            }

                            // по окончанию расчет всех веток от этой фишки, снимает флаг "битая"
                            pieces[beatenPieceIndex].markedAsBeaten = false;
                        } else {
                            // для клеток, расположенных на этой диагонали устанавливаем флаг "Обязан бить"
                            // т.к. если есть возможность бить - то нужно бить обязательно
                            if (thisTurnCanBeatMore) {
                                for (var turn in thisTurnMoves) {
                                    if (! thisTurnMoves[turn].moves.length && // далее двигаться не может
                                        thisTurnMoves[turn].beat && thisTurnMoves[turn].beat.x == kx && thisTurnMoves[turn].beat.y == ky
                                    )
                                    {
                                        // но останавливаться здесь нельзя, т.к. может бить другие шашки
                                        thisTurnMoves[turn].mustBeat = true;
                                    }
                                }
                            }

                            // прерываемся после того, как не можем найти клетку, свободную после побитой
                            mustGoOn = false;
                            break;
                        }
                    }
                }
            }
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
		var html = document.documentElement;
		var body = document.body;

		e.pageX = e.clientX + (html && html.scrollLeft || body && body.scrollLeft || 0) - (html.clientLeft || 0);
		e.pageY = e.clientY + (html && html.scrollTop || body && body.scrollTop || 0) - (html.clientTop || 0);
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
	var countBlack = countWhite = 0;

    // в цикле подсчёт оставшихся шашек
	for (i in pieces) {
		if (pieces[i].isActive) {
			if (pieces[i].isWhite) {
				countWhite++;
			} else {
				countBlack++;
			}
		}
	}

	if (countBlack == 0) return 'white';
	if (countWhite == 0) return 'black';
	return false;
}

/**
 * Проверка на то, что заперты все чьи-то шашки и дамки
 */
function checkLockedPieces() {
    var countLockedBlack = countLockedWhite = 0;

   // в цикле подсчёт ходов шашек
   	for (var i in pieces) {
   		if (pieces[i].isActive) {
            if (!canPieceMove(pieces[i]) && !canPieceBeat(pieces[i])) {
                if (pieces[i].isWhite) {
                    countLockedWhite++
                } else {
                    countLockedBlack++;
                }
            }
   		}
   	}

    if (countLockedWhite == getCountPieces(true)) {return 'white';}
    if (countLockedBlack == getCountPieces(false)){return 'black';}

   	return false;
}

/**
 * Подсчёт количества оставшихся шашек определённого цвета
 * @param isWhite
 */
function getCountPieces(isWhite) {
    var count = 0;

    for (var turn in pieces) {
   		if (pieces[turn].isActive && ((isWhite && pieces[turn].isWhite) || (!isWhite && !pieces[turn].isWhite)) ) {
            count++;
   		}
   	}
    return count;
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
            getCountBeatenPieces(pieces[isSelected].moves, currentPieceRoutes[p], 0, new_x, new_y);
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

/**
 * Изменяет значение координаты, в зависимости от направления
 * @param x_val - изначальное значение координаты
 * @param direction - направление ['NE', 'SE', 'SW', 'NW']
 * @param twice - изменяем значение сразу на два
 */
function modifyXdirection(x_val, direction, twice) {
    // на сколько будем изменять переменную
    adder = twice ? 2 : 1; 

    switch (direction) {
        case 'NE': x_val += adder; break;
        case 'SE': x_val += adder; break;
        case 'NW': x_val -= adder; break;
        case 'SW': x_val -= adder; break;
    }

    return x_val;
}

/**
 * Изменяет значение координаты, в зависимости от направления
 * @param y_val - изначальное значение координаты
 * @param direction - направление ['NE', 'SE', 'SW', 'NW']
 * @param twice - изменяем значение сразу на два
 */
function modifyYdirection(y_val, direction, twice) {
    // на сколько будем изменять переменную
    adder = twice ? 2 : 1;

    switch (direction) {
        case 'NE': y_val -= adder; break;
        case 'SE': y_val += adder; break;
        case 'NW': y_val -= adder; break;
        case 'SW': y_val += adder; break;
    }

    return y_val;
}

/**
 * Преобразовывает Х координату доски в координату в шашечной нотации
 * @param x
 */
function convertXtoLiteral(x) {
    return String.fromCharCode(parseInt(x) + 97);
}

/**
 * Преобразовывает Y координату доски в координату в шашечной нотации
 * @param y
 */
function convertYtoLiteral(y) {
    return (8-y).toString();
}

/**
 * Преобразует координату [a-h] шашечной нотации в координаты на доске [0-7]
 * @param x
 */
function convertLiteralToX(x) {
    return x.charCodeAt(0) - 97;
}

/**
 * Преобразует координату [1-8] шашечной нотации в координаты на доске [0-7]
 * @param y
 */
function convertLiteralToY(x) {
    return (8 - parseInt(x));
}

/**
 * Загружает и проигрывает ходы игры, основываясь на ходах, заданных в url в якоре
 */
function loadGame(turns_info) {
    // массив с ходами ходы
    var turns = [];
    var turn;

    try {
        turns_arr = turns_info.split('|');

        // каждый элемент строки разбиваем на составляющие и далее формируем массив turns
        // :TODO: потенциально небезопасная штука. Сюда нужно много проверок на корректность номеров и самих ходов.
        for (turn in turns_arr) {
            if (!turns_arr[turn]) {continue}

            turns_num_info = turns_arr[turn].split('.');
            turn_number = turns_num_info[0];

            turns.push(turns_num_info[1].split(','));

        }
    } catch(e) {
        alert('Ошибка при загрузке ходов!');
        return;
    }

    // убираем старый якорь с ЗАГРУЗКОЙ игры и будем заменять на реальный игровой
    history.replaceState({}, '', '/');

    // теперь выполняем каждый ход
    console.log(turns);
    for (turn in turns) {

        // поочереди сначала ход белых, а затем черных
        for (round in [0,1]) {

            // проверка на то, что такой ход вообще задан
            if (!turns[turn][round]) {
                continue;
            }

            // ищем разделитель между клетками
            if (turns[turn][round].indexOf('-') > 0) {
                // обычный ход без взятия
                splitter = '-';
            } else {
                // ход со взятием
                splitter = ':';
            }

            splittedTurns = turns[turn][round].split(splitter);

            // преобразование координат
            // начальные координаты
            old_x = convertLiteralToX(splittedTurns[0].charAt(0));
            old_y = convertLiteralToY(splittedTurns[0].charAt(1));

            // конечные координаты
            new_x = convertLiteralToX(splittedTurns[splittedTurns.length - 1].charAt(0));
            new_y = convertLiteralToY(splittedTurns[splittedTurns.length - 1].charAt(1));

            console.log('Получаем шашку в ['+old_x+';'+old_y+'] -> ' + getPieceIndexAt(old_x, old_y));

            // отмечаем шашку, которой будем ходить
            isSelected = getPieceIndexAt(old_x, old_y);

            if (! isSelected) {continue}

            pieces[isSelected].isSelected = true;

            // получаем доступные ходы для шашки
            if (pieces[isSelected].isKing) {
                pieces[isSelected].moves = getKingMovesMap(pieces[isSelected]);
            } else {
                pieces[isSelected].moves = getPieceMovesMap(pieces[isSelected]);
            }

            // выполняем ход
            doTurn(old_x, old_y, new_x, new_y);
        }

    }
    refresh();
}

/**
 * Проходится по массиву currentMoves в соответствии с указанным маршрутом currentPath
 * и формирует путь шашки в шашечной нотации для записи ходов
 * @param currentMoves - рекурсивный массив из ходов
 * @param currentPath - текущий ПРОСЧИТАННЫЙ маршрут шашки
 * @param currentPathPosition - текущий уровень глубины вложенности в currentPath
 */
function getPiecePathLiteral(currentMoves, currentPath, currentPathPosition) {
    // формируем строку с ходами в шашечной нотации
    var thisTurnPath = '';

    if (currentMoves && currentMoves.length > 0) {
        // проходимся по всему дереву всех маршрутов
        for (k in currentMoves) {

            // проверка на то, что текущая координата из возможных координат
            // лежит на маршруте движения фишки
            if (currentMoves[k].x == currentPath[currentPathPosition].x
             && currentMoves[k].y == currentPath[currentPathPosition].y)
            {

                // записываем текущий прыг
                thisTurnPath +=
                    (currentMoves[k].beat ? ':' : '-') +
                    convertXtoLiteral(currentMoves[k].x) + convertYtoLiteral(currentMoves[k].y);

                // можем ли мы идти дальше?
                if (currentMoves[k].moves.length > 0) {
                    // рекурсивно вызываем себя и идём дальше по дереву
                    thisTurnPath += getPiecePathLiteral(currentMoves[k].moves, currentPath, ++currentPathPosition);
                }
            }
        }
    }
    return thisTurnPath;
}


/**
 * Проверка на то, что может ли вообще шашка/дамка ходить в лююбое из направлений?
 * @param cell
 */
function canPieceBeat(cell) {
    // для каждого направления проверяем может ли бить(!)
    // учитывается как для шашки, так и для дамки
    for (dir in directions) {
        if (canBeatAtDirection(cell, directions[dir])) {
            return true;
        }
    }
    return false;
}


/**
 * Проверяет может ли шашка/дамка вообще ходить куда-нибудь или заперта
 * @param cell
 */
function canPieceMove(cell) {
    if (cell.isKing) {
        // для дамки

        // для каждого направления проверяем может ли ходить(!)

        // в цикле для каждого направления ищем возможные ходы
        for (dir in directions) {

            // в цикле идём вдоль диагонали
            for (
                kx = modifyXdirection(cell.x, directions[dir]), ky = modifyYdirection(cell.y, directions[dir]);
                true;
                kx = modifyXdirection(kx, directions[dir]), ky = modifyYdirection(ky, directions[dir]) // меняем kx и ky в зависимости от направления
            )
            {
                // если клетка "не стенка" и там никого нет
                if (isValidCell(kx, ky) && ! isPieceHere(kx, ky)) {
                    return true;
                } else {
                    break;
                }
            }
        }

    } else {
        // для шашки

        if (cell.isWhite) {
            // направления, по которым могут ходить(!) белые(!) шашки
            dirs = ['NE', 'NW'];
        } else {
            // направления, по которым могут ходить(!) черные(!) шашки
            dirs = ['SE', 'SW'];
        }

        // в цикле для каждого направления определяем возможность походить на соседнюю клетку
        for (dir in dirs) {
            if (isValidCell(modifyXdirection(cell.x, dirs[dir]), modifyYdirection(cell.y, dirs[dir])) &&
                ! isPieceHere(modifyXdirection(cell.x, dirs[dir]), modifyYdirection(cell.y, dirs[dir]))
            )
            {
                return true;
            }
        }
    }
    return false;

}