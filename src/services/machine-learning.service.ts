import * as tf from '@tensorflow/tfjs';
import _ from 'lodash';
import { Score } from '../shared/models/score.interface';

export interface ModelParams {
  name: string;
  inputs: number[][];
  outputs: number[];
  trainingSize: number;
  windowSize: number;
  epochs: number;
  learningRate: number;
  layers: number;
}
class MachineLearningService {
  trainedModels = {};
  // getIntradayData(symbol, currentDate, startDate) {
  //   return QuoteService.queryForIntraday(symbol, startDate, currentDate);
  // }

  // getDailyData(symbol, currentDate, startDate) {
  //   return BacktestService.getData(symbol, currentDate, startDate);
  // }

  async trainModel(modelParams: ModelParams, callback) {
    console.log('training size: ', modelParams.inputs.length);
    console.log(modelParams);

    const inputs = modelParams.inputs;
    const outputs = modelParams.outputs;
    const trainingsize = modelParams.trainingSize;
    const windowSize = modelParams.windowSize;
    const nEpochs = modelParams.epochs;
    const learningRate = modelParams.learningRate;
    const nLayers = modelParams.layers;

    const input_layer_shape = windowSize;
    const input_layer_neurons = 50;

    const rnn_input_layer_features = 10;
    const rnn_input_layer_timesteps = input_layer_neurons / rnn_input_layer_features;

    const rnn_input_shape = [rnn_input_layer_features, rnn_input_layer_timesteps];
    const rnn_output_neurons = 20;

    const rnn_batch_size = windowSize;

    const output_layer_shape = rnn_output_neurons;
    const output_layer_neurons = 1;

    const X = inputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));
    const Y = outputs.slice(0, Math.floor(trainingsize / 100 * outputs.length));

    const xs = tf.tensor2d(X, [X.length, X[0].length]).div(tf.scalar(10));
    const ys = tf.tensor2d(Y, [Y.length, 1]).reshape([Y.length, 1]).div(tf.scalar(10));

    const model = tf.sequential();

    model.add(tf.layers.dense({ units: input_layer_neurons, inputShape: [input_layer_shape] }));
    model.add(tf.layers.reshape({ targetShape: rnn_input_shape }));

    const lstm_cells = [];
    for (let index = 0; index < nLayers; index++) {
      lstm_cells.push(tf.layers.lstmCell({ units: rnn_output_neurons }));
    }

    model.add(tf.layers.rnn({
      cell: lstm_cells,
      inputShape: rnn_input_shape,
      returnSequences: false
    }));

    model.add(tf.layers.dense({ units: output_layer_neurons, inputShape: [output_layer_shape] }));

    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'meanSquaredError'
    });

    const hist = await model.fit(xs, ys,
      {
        batchSize: rnn_batch_size, epochs: nEpochs, callbacks: {
          onEpochEnd: async (epoch, log) => {
            callback(epoch, log, modelParams);
          }
        }
      });

    this.trainedModels[modelParams.name] = model;
    // await model.save('localstorage://tfjs-stocks');
    // const model = await tf.loadLayersModel('localstorage://tfjs-stocks');
    // const hist = {};
    console.log('stats: ', hist);
    return { model: model, stats: hist };
  }

  async makePredictions(inputs, model) {
    // let X = inputs.slice(Math.floor(size / 100 * inputs.length), inputs.length);
    if (model) {
      const predictedResults = model.predict(tf.tensor2d(inputs, [inputs.length, inputs[0].length]).div(tf.scalar(10))).mul(10);
      return Array.from(predictedResults.dataSync());
    } else {
      return null;
    }
  }

  // async score(modelParams: ModelParams) {
  //   const scorekeeper: Score = { guesses: 0, correct: 0, score: 0 };

  //   for (let i = Math.floor(modelParams.trainingSize / 100 * modelParams.outputs.length); i < modelParams.inputs.length; i++) {
  //     const startingIdx = i - 30 > 0 ? i - 30 : 0;
  //     const inputs = modelParams.inputs.slice(startingIdx, i);

  //     const prediction = await this.makePredictions(inputs, this.trainedModels[modelParams.name]);
  //     const roundedPrediction = _.round(Number(prediction[0]), 2);

  //     const actual = _.round(modelParams.outputs[i][0], 2);
  //     console.log('Prediction: ', roundedPrediction, actual);

  //     if (roundedPrediction === actual) {
  //       scorekeeper.correct++;
  //     }
  //     scorekeeper.guesses++;
  //   }

  //   scorekeeper.score = scorekeeper.correct / scorekeeper.guesses;
  //   return scorekeeper;
  // }

  async score(modelParams: ModelParams) {
    const scorekeeper: Score = { guesses: 0, correct: 0, score: 0 };

    const predictions = await this.makePredictions(modelParams.inputs.slice(Math.floor(modelParams.trainingSize / 100 * modelParams.inputs.length),
      modelParams.inputs.length), this.trainedModels[modelParams.name]);

    const actual = modelParams.outputs.slice(Math.floor(modelParams.trainingSize / 100 * modelParams.outputs.length),
      modelParams.outputs.length);

    predictions.forEach(async (prediction, idx) => {
      const pred = _.round(Number(prediction), 2);
      console.log('Prediction: ', prediction, actual[idx]);

      if (pred > 0.5) {
        if (pred === _.round(actual[idx], 2)) {
          scorekeeper.correct++;
        }
        scorekeeper.guesses++;
      }
    });

    scorekeeper.score = scorekeeper.correct / scorekeeper.guesses;
    return scorekeeper;
  }

}

export default new MachineLearningService();
