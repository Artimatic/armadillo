import * as neataptic from 'neataptic';
import { TrainingData } from '../shared/models/training-data.interface';
import { Score } from '../shared/models/score.interface';
import { NetworkOptions } from '../shared/models/network-options.interface';
import * as _ from 'lodash';

const defaultOptions: NetworkOptions = {
    log: 10000,
    iterations: 10000,
    error: 0.08,
    clear: true,
    rate: 0.01,
    trainingSize: 0.7
};

class Precog {
    closePriceNetwork = {};
    network = {};
    previous: any;
    trainingData: any[] = [];
    constructor() { }

    public activate(symbol: string, input, round: boolean, useClosePrice = false): Score {
        const scorekeeper: Score = { guesses: 0, correct: 0, score: 0 };

        const result = useClosePrice ? this.closePriceNetwork[symbol].activate(input) : this.network[symbol].activate(input);
        if (round) {
            scorekeeper.nextOutput = _.round(result);
        } else {
            console.log('result: ', result);
            scorekeeper.nextOutput = _.round(result, 2);
        }

        return scorekeeper;
    }

    public testLstm(symbol: string, trainingData: TrainingData[], options = defaultOptions): any {
        const trainingSet = trainingData.slice(0, Math.floor((options.trainingSize || 0.7) * trainingData.length));

        console.log('Network settings: ', options);
        console.log('Training data size: ', trainingData.length);

        this.closePriceNetwork[symbol] = new neataptic.architect.LSTM(5, 6, 1);
        this.closePriceNetwork[symbol].train(trainingSet, options);
        return this.score(symbol,
                        trainingData.slice(Math.floor(options.trainingSize / 100 * trainingData.length),
                        trainingData.length),
                        this.closePriceNetwork[symbol]);
    }

    public testLstmClosePrice(symbol: string, trainingData: TrainingData[], options = defaultOptions): any {
        const trainingSet = trainingData.slice(0, Math.floor((options.trainingSize || 0.7) * trainingData.length));

        console.log('Network settings: ', options);
        console.log('Training data size: ', trainingData.length);

        this.network[symbol] = new neataptic.architect.LSTM(5, 6, 1);
        this.network[symbol].train(trainingSet, options);
        return this.score(symbol,
                        trainingData.slice(Math.floor(options.trainingSize / 100 * trainingData.length),
                        trainingData.length),
                        this.network[symbol]);
    }

    private score(symbol: string, scoringSet: TrainingData[], network) {
        const scorekeeper: Score = { guesses: 0, correct: 0, score: 0 };

        for (let i = 0; i < scoringSet.length; i++) {
            if (scoringSet[i]) {
                const actual = scoringSet[i].output;
                const input = scoringSet[i].input;
                if (input) {
                    const rawPrediction = network.activate(input);
                    const prediction = Math.round(rawPrediction);

                    if (actual && prediction !== undefined) {
                        if (i % 100 === 0) {
                            console.log(`${i}: actual: ${actual}, prediction: ${prediction}`);
                        }

                        scorekeeper.guesses++;
                        if (actual[0] === prediction) {
                            scorekeeper.correct++;
                        }
                    }

                    if (!actual) {
                        scorekeeper.nextOutput = prediction;
                        console.log(`prediction: ${prediction}`);
                    }
                }
            }
        }

        scorekeeper.score = scorekeeper.correct / scorekeeper.guesses;

        console.log('Score: ', scorekeeper);
        return scorekeeper;
    }
}

export default new Precog();
