## Description
This is a small example to illustrate how tracks can be generated and send to a STOPM broker.
This samples sends updates of flights moving over the USA between airports.

## How to install:
Intall all the project dependencies with npm
```
npm install
```

## To use
### Start the application development mode
```
npm start
```
The application will start emiting tracks at: 
/topic/producers/flights/


The topics can be refined to restrict the airport from departure, airport from arrival, company, or flight id 
/topic/producers/flights/data/company/from/to/id

### Start the application for production
For production we strongly advise using pm2 to supervise and keep the application running in the background
```
pm2 start index.js --name cartracking --exp-backoff-restart-delay=100
```

## Available topics

/topic/producers/flights/{from}/{to}/{id}

Example:   
/topic/producers.flights.data.klm.>   (Only flights from KLM)

/topic/producers.flights.data.*.MAD.>     (Only flighst from Madrid)   
/topic/producers.flights.data.*.*.MAD.>     (Only flighst to Madrid)   
