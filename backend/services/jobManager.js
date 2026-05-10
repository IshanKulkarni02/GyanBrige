/**
 * Job Manager
 * In-memory store for parallel-track lecture processing jobs.
 * Each job has independent video and notes tracks that emit progress.
 */

const { v4: uuidv4 } = require('uuid');

const jobs = new Map();

const TRACK_DEFAULTS = () => ({
  status: 'pending',
  progress: 0,
  step: 'Waiting...',
  startedAt: null,
  finishedAt: null,
  output: null,
  error: null,
});

function createJob(meta = {}) {
  const id = uuidv4();
  const job = {
    id,
    status: 'processing',
    createdAt: Date.now(),
    finishedAt: null,
    meta,
    video: TRACK_DEFAULTS(),
    notes: TRACK_DEFAULTS(),
    log: [],
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function listJobs() {
  return Array.from(jobs.values());
}

function update(id, track, patch) {
  const job = jobs.get(id);
  if (!job) return;
  const t = job[track];
  if (!t) return;

  Object.assign(t, patch);
  if (patch.status === 'running' && !t.startedAt) t.startedAt = Date.now();
  if (patch.status === 'complete' || patch.status === 'error') {
    t.finishedAt = Date.now();
  }

  job.log.push({
    at: Date.now(),
    track,
    status: t.status,
    progress: t.progress,
    step: t.step,
  });

  // Roll up overall job status
  if (job.video.status === 'error' || job.notes.status === 'error') {
    if (job.video.status !== 'running' && job.notes.status !== 'running') {
      job.status =
        job.video.status === 'complete' || job.notes.status === 'complete'
          ? 'partial'
          : 'error';
      job.finishedAt = Date.now();
    }
  } else if (job.video.status === 'complete' && job.notes.status === 'complete') {
    job.status = 'complete';
    job.finishedAt = Date.now();
  }
}

function setProgress(id, track, progress, step, status = 'running') {
  update(id, track, { status, progress, step });
}

function complete(id, track, output) {
  update(id, track, {
    status: 'complete',
    progress: 100,
    step: 'Done',
    output,
  });
}

function fail(id, track, error) {
  update(id, track, {
    status: 'error',
    step: `Failed: ${error.message || error}`,
    error: String(error.message || error),
  });
}

function cleanup(maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.finishedAt && now - job.finishedAt > maxAgeMs) {
      jobs.delete(id);
    }
  }
}

setInterval(cleanup, 10 * 60 * 1000).unref?.();

module.exports = {
  createJob,
  getJob,
  listJobs,
  setProgress,
  complete,
  fail,
};
