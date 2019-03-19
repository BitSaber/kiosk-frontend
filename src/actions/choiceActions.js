import service from '../service';
import { RESET_ALL_CHOICES, GET_CHOICES, SET_CURRENT_CHOICES,
    SET_SELECTED_CHOICES, SET_CHOICES_LOADING_STATE } from '../constants/actions';
import { LOADING_STATE, FINISHED_STATE } from '../constants/loadingStates';

export const getAllChoicesAction = (questions, langId) => {
    return async (dispatch) => {
        // set the lodaing state to load
        dispatch({
            type: SET_CHOICES_LOADING_STATE,
            payload: LOADING_STATE,
        });
        // we first reset the choices incase we are changing language
        dispatch({
            type: RESET_ALL_CHOICES,
        });
        // here we use a for-loop to go through all questions (preferably sorted in some fashion),
        // and dispatch them one by one to an array with all the possible choices
        const qLen = questions.length;
        for (let i = 0; i < qLen; i++) {
            const choices = await service.getChoices(questions[i].id, langId);
            dispatch({
                type: GET_CHOICES,
                payload: choices,
            });
        }
        // set the lodaing state to be finished
        dispatch({
            type: SET_CHOICES_LOADING_STATE,
            payload: FINISHED_STATE,
        });
    };
};

export const setCurrentChoicesAction = (questionPosition) => ({
    type: SET_CURRENT_CHOICES,
    payload: questionPosition,
});

export const setSelectedChoicesAction = (choices) => ({
    type: SET_SELECTED_CHOICES,
    payload: choices,
});
