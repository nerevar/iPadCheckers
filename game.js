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
					pieces[isSelected].moves = getKingMovesMap({x : pieces[isSelected].x, y : pieces[isSelected].y, isWhite: pieces[isSelected].isWhite});
				} else {
					pieces[isSelected].moves = getPieceMovesMap({x : pieces[isSelected].x, y : pieces[isSelected].y, isWhite: pieces[isSelected].isWhite});
				}

                console.log(pieces[isSelected].moves);

                // подсвечиваем желтым возможные ходы
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
                canPieceMove(pieces[isSelected].moves, new_x, new_y);

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

                    log.add((whiteTurn ? 'Белые&nbsp;&nbsp;' : 'Черные') +
                        ' [' + pieces[isSelected].x + ';' + pieces[isSelected].y + '] -> [' + new_x + ';' + new_y + ']'
                    );

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
                canPieceMove(pieces[isSelected].moves, new_x, new_y);

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