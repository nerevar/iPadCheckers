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
				if (pieces[isSelected].isKing) {
					pieces[isSelected].moves = getKingMovesMap(pieces[isSelected]);
				} else {
					pieces[isSelected].moves = getPieceMovesMap(pieces[isSelected]);
				}

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

			old_x = pieces[isSelected].x;
			old_y = pieces[isSelected].y;

			// переместили шашку, координаты различаются
			if (new_x != old_x || new_y != old_y) {
				// осуществляет ход шашки
				doTurn(old_x, old_y, new_x, new_y)
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
				canPieceMoveInRoutes(pieces[isSelected].moves, new_x, new_y);

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