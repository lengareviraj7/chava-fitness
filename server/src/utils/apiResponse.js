export const sendSuccess = (res, data, messageOrStatus = 200, maybeStatus = 200) => {
  let statusCode = 200;
  let message = undefined;
  if (typeof messageOrStatus === 'number') {
    statusCode = messageOrStatus;
  } else if (typeof messageOrStatus === 'string') {
    message = messageOrStatus;
    if (typeof maybeStatus === 'number') {
      statusCode = maybeStatus;
    }
  }
  const payload = { success: true, data };
  if (message) payload.message = message;
  return res.status(statusCode).json(payload);
};

export const sendError = (res, message, code = 'ERROR', statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
    },
  });
};
