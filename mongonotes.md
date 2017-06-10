# drop collection
```javascript
use <db>
db.<collection>.drop()
```

# find
```javascript
use <db>
db.<collection>.find() # find all
db.<collection>.find().pretty() # prettify
db.<collection>.find(<query>)
    { "<field>": <value>, <field1>: <value>}
    { "<field>": { $gt: <value> }}
    { "<field>.<field>": <value>}
        e.g. {"payload": {"timestamp":3, "name": "tim" }}
             query: {"payload.timestamp": {$gt: 2}}
        e.g. {"timestamp": {$gt: ISODate("2017-03-10T12:13:00.000Z")}}
    { $and: [
        {<field>: <value>},
        { <field>: { $gte: <value>, $lt: <value> }}
    ]}
db.<collection>.find(<query>).sort(<expr>)
    {"<field1>": 1(=asc), "<field2>": 0(=desc)}

# find last record
db.nodes.find().limit(1).sort({natural:-1})

# unique / distinct records
db.<collection>.distinct("<field>") # array of distinct values in the field
db.<collection>.distinct("<field>")[0] # first distinct item
db.<collection>.find().limit(1).sort({$natural:-1})
```

# create index
```javascript
db.<collection>.createIndex({<field1>:1, [<field2>:1, <field3>:1]})
db.nodes.createIndex({timestamp:1})
db.nodes.createIndex({timestamp:1, node:1})
```

# aggregate
```javascript
# add a derived value
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"}
        }},
    ]
)

# filter on derived field
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"}
        }},
        { $match: { hour: 12 } },
    ]
)

# sumarise all selected records
##  _id is mandatory in $group
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"},
        }},
        { $match: { hour: 12 } },
        { $group: {
                _id: null,
                averageTemp: { $avg: "$t" },
                averageHumidity: { $avg: "$h"},
                averageLuminance: { $avg: "$l"}
            }
        }
    ]
)

# sumarise by id value, midday daily
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"},
        }},
        { $match: { hour: 12 } },
        { $group: {
                _id: { day:{$dayOfMonth: "$timestamp"}, month:{$month:"$timestamp"}, year:{$year:"$timestamp"}},
                averageTemp: { $avg: "$t" },
                averageTemp: { $avg: "$t" },
                averageHumidity: { $avg: "$h"},
                averageLuminance: { $avg: "$l"},
                count: { $sum: 1 }
            }
        }
    ]
)

# sumarise by id value, every hour of every day
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"},
        }},
        { $group: {
                _id: { hour:{$hour:"$timestamp"}, day:{$dayOfMonth: "$timestamp"}, month:{$month:"$timestamp"}, year:{$year:"$timestamp"}},
                averageTemp: { $avg: "$t" },
                averageTemp: { $avg: "$t" },
                averageHumidity: { $avg: "$h"},
                averageLuminance: { $avg: "$l"},
                count: { $sum: 1 }
            }
        },
        {
            $sort: {"_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour":1 }
        }
    ]
)

# sumarise by id value, every hour of every day for particular year/month
db.nodes.aggregate(
    [
        { $project: {
            node: true, h: true, t: true, l: true, timestamp: true, _id: true,
            hour: { $hour: "$timestamp"},
            month: { $month: "$timestamp"},
            year: { $year: "$timestamp"}
        }},
        { $match: { month: 6, year: 2017 } },
        { $group: {
                _id: {
                   hour:{$hour:"$timestamp"},
                   day:{$dayOfMonth: "$timestamp"},
                    month:{$month:"$timestamp"},
                    year:{$year:"$timestamp"}
                },
                averageTemp: { $avg: "$t" },
                averageTemp: { $avg: "$t" },
                averageHumidity: { $avg: "$h"},
                averageLuminance: { $avg: "$l"},
                count: { $sum: 1 }
            }
        },
        {
            $sort: {"_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour":1 }
        }
    ]
)


# create array of matching doc values
db.nodes.aggregate(
    [
        { $project: {
            t: true, timestamp: true,
            hour: { $hour: "$timestamp"},
        }},
        { $match: { hour: 12 } },
        { $group: {
                _id: { day:{$dayOfMonth: "$timestamp"}, month:{$month:"$timestamp"}, year:{$year:"$timestamp"}},
                temps: { $push: "$t" }
            }
        }
    ]
)
```