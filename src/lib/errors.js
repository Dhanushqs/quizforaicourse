// An error that carries an HTTP status code (400 = bad input, 401 = not allowed, ...).
// The message is safe to show to the user.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
