const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => next(err)); // Pass error to global error handler
  };
};

export default catchAsync;
