const { createSession, distance, calories } = require('./core.js');

function assertClose(actual, expected, tol = 0.001, label){
  const diff = Math.abs(actual - expected);
  if(diff > tol){
    throw new Error(`${label} 失敗：實際 ${actual}，預期 ${expected}，差異 ${diff}`);
  }
}

function runScenario(name, fn){
  try{
    fn();
    console.log('PASS:', name);
  } catch (err){
    console.log('FAIL:', name, err.message);
  }
}

// 1) 正常走路：三點連續，總距離約 60m
runScenario('正常走路', () => {
  const s = createSession({ kg: 60, met: 3.5 });
  s.start(0);

  s.addPoint({ lat: 24.180000, lng: 120.649000, t: 0, accuracy: 6 });
  s.addPoint({ lat: 24.180500, lng: 120.649000, t: 1000, accuracy: 6 }); // 約 55.6m
  s.addPoint({ lat: 24.181000, lng: 120.649000, t: 2000, accuracy: 6 }); // 另約 55.6m

  const stats = s.finish(2000);

  assertClose(stats.totalMeters, 111.2, 5, 'totalMeters');
  assertClose(stats.activeSeconds, 2, 0.001, 'activeSeconds');
  assertClose(stats.averageKmh, 200.0, 20, 'averageKmh');
  assertClose(stats.caloriesKcal, calories(3.5, 60, 2), 0.001, 'caloriesKcal');
  assertClose(stats.validPointCount, 3, 0, 'validPointCount');
  assertClose(stats.segmentCount, 1, 0, 'segmentCount');
  assertClose(stats.startEndMeters, 0.000111, 0.05, 'startEndMeters'); // 兩點距離約 111m
  assertClose(stats.maxAdjacentKmh, 200, 20, 'maxAdjacentKmh');
});

// 2) GPS 抖動：短距離小漂移被拒絕
runScenario('GPS 抖動', () => {
  const s = createSession({ kg: 60, met: 3.5 });
  s.start(0);

  s.addPoint({ lat: 24.180000, lng: 120.649000, t: 0, accuracy: 6 });
  s.addPoint({ lat: 24.1800002, lng: 120.6490002, t: 1000, accuracy: 6 }); // 太小，會被 reject

  const stats = s.getStats(1000);
  assertClose(stats.validPointCount, 1, 0, 'reject');
  assertClose(stats.segmentCount, 1, 0, 'segment');
});

// 3) GPS 間隔超過 30 秒：新段
runScenario('跨段 30 秒', () => {
  const s = createSession({ kg: 60, met: 3.5 });
  s.start(0);

  s.addPoint({ lat: 24.180000, lng: 120.649000, t: 0, accuracy: 6 });
  s.addPoint({ lat: 24.180500, lng: 120.649000, t: 1000, accuracy: 6 });
  s.addPoint({ lat: 24.181000, lng: 120.649000, t: 32000, accuracy: 6 }); // 30s+ -> break

  const stats = s.getStats(32000);
  assertClose(stats.segmentCount, 2, 0, 'segmentCount');
  assertClose(stats.validPointCount, 3, 0, 'validPointCount');
});

// 4) 暫停後恢復
runScenario('暫停後恢復', () => {
  const s = createSession({ kg: 60, met: 3.5 });
  s.start(0);

  s.addPoint({ lat: 24.180000, lng: 120.649000, t: 0, accuracy: 6 });
  s.addPoint({ lat: 24.180500, lng: 120.649000, t: 1000, accuracy: 6 });

  s.pause(5000);
  s.resume(10000);

  s.addPoint({ lat: 24.181000, lng: 120.649000, t: 15000, accuracy: 6 });

  const stats = s.getStats(15000);
  assertClose(stats.activeSeconds, 15, 0.001, 'activeSeconds');
  assertClose(stats.segmentCount, 2, 0, 'segmentCount');
});

// 5) 零資料 / activeSeconds 為 0
runScenario('零資料', () => {
  const s = createSession({ kg: null, met: null });
  const stats = s.getStats(0);
  assertClose(stats.totalMeters, 0, 0, 'totalMeters');
  assertClose(stats.averageKmh, 0, 0, 'averageKmh');
  assertClose(stats.activeSeconds, 0, 0, 'activeSeconds');
  assertClose(stats.caloriesKcal, null, 0, 'caloriesKcal');
  assertClose(stats.validPointCount, 0, 0, 'validPointCount');
  assertClose(stats.segmentCount, 0, 0, 'segmentCount');
  assertClose(stats.startEndMeters, 0, 0, 'startEndMeters');
  assertClose(stats.maxAdjacentKmh, 0, 0, 'maxAdjacentKmh');
});

// 6) 時間為 0
runScenario('時間為 0', () => {
  const s = createSession({ kg: 60, met: 3.5 });
  s.start(0);
  const stats = s.getStats(0);
  assertClose(stats.averageKmh, 0, 0, 'averageKmh');
  assertClose(stats.activeSeconds, 0, 0, 'activeSeconds');
});

// 7) 無效體重 / MET
runScenario('無效體重與 MET', () => {
  const result = calories(0, 60, 60);
  assertClose(result, null, 0, 'calories');
  const result2 = calories(3.5, 0, 60);
  assertClose(result2, null, 0, 'calories');
});
