var app = angular.module("app", []);

app.controller("main", function($scope, $http, $interval) {

    node = "esp8266:18:fe:34:e1:1d:8b";
    month = 6;
    year = 2017;
    start = new Date(year, month-1, 1, 0, 0, 0, 0)
    end = new Date(new Date(year, month, 1, 0, 0, 0, 0)-1)
    datapoints = ["averageTemp", "averageHumidity"];

    width = 900;
    height = 50;
    margin = {left:15, right:15, top:15, bottom:30}

    canvas = d3.select("#summary")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    chart = canvas.append("g")
            .attr(
                "transform", "translate("
                // + ((width / 2) + margin.left) + ","
                // + ((height / 2) + margin.top) + ")"
                + margin.left + ","
                + margin.top + ")"
            );

    x = d3.scaleTime()
        .domain([start, end])
        .range([0, width]);

    // only appropriate for t & h
    y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0])

    canvas.append("g")
        .call(
            d3.axisBottom(x)
                .ticks(new Date(year,month,0).getDate())
                .tickFormat(d3.timeFormat("%d"))
        )
        .attr("transform", "translate(" + margin.left + "," + (height + margin.top) + ")");

    line = function(datapoint) {
        return d3.line()
            .x( (d) => x(new Date(d._id.year, d._id.month-1, d._id.day, d._id.hour,0,0,0)))
            .y( (d) => y(d[datapoint]))
            .curve(d3.curveBasis);
    };

    $http.get(
        "iocp/summary"
        + "?node=" + node
        + "&year=" + year
        + "&month=" + month
    ).then(function(response){

        data = response.data;

        for (k in datapoints) {

            chart.append("path")
                .datum(data)
                .attr("d", line(datapoints[k]))
                .attr("style", "stroke:black; stroke-width:1; fill:none;");

        };

    });

})