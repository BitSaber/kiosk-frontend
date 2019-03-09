import React from 'react';
import { string, object, func } from 'prop-types';

import questionService from './service'
import ThankYouPage from './pages/ThankYouPage';
import QuestionPage from './containers/QuestionPage';
import {
    SELECT,
    MULTI_SELECT,
    STR,
    UNINITIALIZED as QUESTION_TYPE_UNINITIALIZED
} from './constants/questionTypes';

const initialState = {
    questions: [],
    currentQuestionID: null,
    currentQuestionType: QUESTION_TYPE_UNINITIALIZED,
    currentQuestionChoices: [],
    currentIsRequired: false,
    isAllQuestionsAnswered: false,
    areAllQuestionsDisplayed: false,
    categoryId: null,
    placeId: null,
    multiSelectArray: [],
    error: null
}

export class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = { ...initialState };
    }

    async componentDidMount() {
        this.setInfo();
    }

    setInfo = async () => { // better name ideas?
        const cat = await questionService.getCategory()
        const loc = await questionService.getPlace()

        // Sets the state with necessary attributes fetched from the API, and calls setFirstQuestion after
        this.setState({
            category: cat[0].id,
            place: loc[0].id,
        }, this.setFirstQuestion);
    }

    setFirstQuestion = async () => {
        const { currentLanguageId } = this.props;

        const questions = await questionService.getQuestions(currentLanguageId);
        const questionsSorted = questions.sort((object1, object2) => object1.id - object2.id)
        const currentQuestionID = questions[0].id;
        const choices = await questionService.getChoices(currentQuestionID, currentLanguageId);
        const questionType = questions[0].type
        const isReq = questions[0].required
        this.setState({
            questions: questionsSorted,
            currentQuestionID: currentQuestionID,
            currentIsRequired: isReq,
            currentQuestionChoices: choices,
            currentQuestionType: questionType
        });
    }

    checkNextQuestion = (position) => {
        //makes an array with all answer ID's
        const answerIDs = Object.values(this.props.answers).map(function (object) {
            if (Array.isArray(object)) {
                return object.map(x => x.id)
            }
            else {
                return object.id
            }
        }).flat()
        const nextQuestion = this.state.questions.find(question => question.position === position)
        if (nextQuestion.depends_on_question_id === null) {
            return true
        } else if (answerIDs.includes(nextQuestion.depends_on_choice_id)) {
            return true
        } else {
            return false
        }
    }

    setNextQuestion = async () => {
        // finds the next question to display
        const questionsLen = this.state.questions.length
        var position = this.state.questions.find(
            question => question.id === this.state.currentQuestionID).position + 1
        var flag = true
        // Loop through the questions by position, and determine if the question at hand needs to be displayed
        while (position <= questionsLen && flag) {
            if (this.checkNextQuestion(position)) {
                flag = false
                this.setQuestion(position)
            } else {
                position += 1
            }
        }
        // Check if the last displayed question still needs an answer, or if the thank you page can be displayed
        if (position >= questionsLen) {
            this.state.areAllQuestionsDisplayed = true
            if (flag) {
                this.state.isAllQuestionsAnswered = true
            }
        }
    }

    setQuestion = (newPosition) => {
        const { currentLanguageId } = this.props;

        // Sets the question with the predetermined position as the new current question and gets the questions choices from the API.
        const newQuestion = this.state.questions.find(question => question.position === newPosition)
        const newQuestionID = newQuestion.id
        const questionType = newQuestion.type
        const isReq = newQuestion.required
        this.setState({
            currentQuestionID: newQuestionID,
            currentQuestionType: questionType,
            currentIsRequired: isReq,
        }, async () => {
            if (this.state.currentQuestionType !== STR) {
                const newChoices = await questionService.getChoices(newQuestionID, currentLanguageId);

                // Sets an empty answer array for multi select question
                if (this.state.currentQuestionType === MULTI_SELECT) {
                    this.setState({
                        currentQuestionChoices: newChoices,
                        multiSelectArray: []
                    })
                } else {
                    this.setState({
                        currentQuestionChoices: newChoices
                    })
                }
            }
        });
    }

    multiAnswerClick = (choice) => {
        // this is supposed to handle adding new choices to an array
        // which is then give to submitMultiClick when asnwerer is finished

        if (!this.state.multiSelectArray.map(object => object.id).includes(choice.id)) {
            const newChoice = [{ id: choice.id }]
            this.setState((previousState) => {
                return {
                    ...previousState,
                    multiSelectArray: previousState.multiSelectArray.concat(newChoice)
                }
            })
        } else {
            const pos = this.state.multiSelectArray.map(object => object.id).indexOf(choice.id)
            const newMultiSelectArray = this.state.multiSelectArray.filter((_, i) => i !== pos)
            this.setState((previousState) => {
                return {
                    multiSelectArray: newMultiSelectArray,
                    ...previousState,
                }
            })
        }
    }

    showFieldRequired = () => {
        if (!this.state.error) {
            this.setState({ error: true });
            setTimeout(() => {
                this.setState({ error: null });
            }, 3000);
        }
    }

    submitTextAnswer = async (text) => {
        const { addAnswer } = this.props;
        const { currentQuestionID } = this.state;

        if (('' + text).trim() === '' && this.state.currentIsRequired) {
            this.showFieldRequired();
        } else {
            await addAnswer({
                questionId: currentQuestionID,
                answer: text,
            });
            this.moveToNextQuestion();
        }
    }

    submitMultiAnswer = async () => {
        const { addAnswer } = this.props;
        const { currentQuestionID, multiSelectArray, currentIsRequired } = this.state;
        if (multiSelectArray.length === 0 && currentIsRequired) {
            this.showFieldRequired()
        } else {
            await addAnswer({
                questionId: currentQuestionID,
                answer: multiSelectArray,
            });
            this.moveToNextQuestion()
        }
    }

    singleAnswerClick = async (choice) => {
        const { addAnswer } = this.props;
        const { currentQuestionID } = this.state;

        await addAnswer({
            questionId: currentQuestionID,
            answer: {
                id: choice.id
            },
        })

        this.moveToNextQuestion()
    }

    moveToNextQuestion = () => {
        const { currentQuestionID, questions } = this.state;
        const position = questions.findIndex(question => question.id === currentQuestionID);

        if (!this.state.areAllQuestionsDisplayed) { // more questions
            this.setNextQuestion(position);
            if (this.state.areAllQuestionsDisplayed && this.state.isAllQuestionsAnswered) {
                this.submitObservation()
            }
        } else { // no more questions
            this.submitObservation();
        }
    }

    handleChoiceClick = (choice) => {
        if (this.state.currentQuestionType === SELECT) {
            this.singleAnswerClick(choice)
        } else if (this.state.currentQuestionType === MULTI_SELECT) {
            this.multiAnswerClick(choice)
        }
    }

    submitObservation = () => {
        const { answers, resetAnswers } = this.props;

        const time = new Date().toString().substring(0, 21)
        const place = this.state.place
        const category = this.state.category
        const data = {
            occurred_at: time,
            place: place,
            deadline: null,
            category: category,
            answers: answers
        }

        questionService.postObservation(data);
        resetAnswers();

        this.setState({
            isAllQuestionsAnswered: true,
        });

        this.setInfo();

        setTimeout(() => {
            this.setState({
                isAllQuestionsAnswered: false,
                areAllQuestionsDisplayed: false
            });
        }, 3000);
    }

    render() {

        const question = this.state.questions.find(question => question.id === this.state.currentQuestionID);
        // question is undefined and we are waiting for it from the server
        if (!question) {
            return null;
        }

        if (this.state.isAllQuestionsAnswered) {
            return <ThankYouPage />;
        }

        return (
            <QuestionPage
                question={question}
                questionChoices={this.state.currentQuestionChoices}
                onChoiceClick={this.handleChoiceClick}
                questionType={this.state.currentQuestionType}
                onSubmitMultiClick={this.submitMultiAnswer}
                onSubmitFreeText={this.submitTextAnswer}
                questionPos={this.state.questions.findIndex(question => question.id === this.state.currentQuestionID)}
                error={this.state.error}
                currentIsRequired={this.state.currentIsRequired}
                skipClick={this.moveToNextQuestion}
            />
        );
    }
}

App.propTypes = {
    currentLanguageId: string.isRequired,
    answers: object.isRequired,
    addAnswer: func.isRequired,
    resetAnswers: func.isRequired,
}

export default App;
