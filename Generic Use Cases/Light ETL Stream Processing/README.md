# Lightweight Extract, Tranform and Load (ETL) Stream Processors using Kepware Universal Device Driver and IoT Gateway REST Client Agent

## Quick Start:

1. Load Kepware project file
	- Includes simulation tags, Javascript for Universal Device Driver and one "stream processor"- a single IoT Gateway REST Client Agent publishing to a single UDD channel/device
2. Launch Quick Client from the Kepware Configuration tool
	- Observe initial value of udd1.processor.result.true_tags
	- Observe initial values of 600 simulated Boolean tags
	- Adjust Boolean state of one or more simulated tags to True (write a non-zero value to the tags using Quick Client)
	- Observe names of tags with True states organized a comma-seperated string in udd1.processor.result.true_tags

## Overview

This example demonstrates how Kepware Universal Device Driver can be used with IoT Gateway Client Agents to act together as lightweight stream processors. The UDD profile receives, prepares and processes continuous incoming data and caches the results for access and distribution across all Kepware publisher and server interfaces. Data input is published from a local Kepware IoT Gateway (IOTG) REST Client Agent. Tags from any Kepware driver can be added or removed from the REST Client Agent via GUI or API to be included or excluded from UDD ETL stream processing. 

The simple processor included in the example currently observes Boolean tags for True states and provides a comma-seperated list of tag names:

"simulator.data.600_bools.bool107,simulator.data.600_bools.bool5,simulator.data.600_bools.bool599"

Notes: To create one complete processor, one IOTG REST Client Agent should publish to one UDD channel/device. This profile can be shared across all UDD channels.

Benchmarks: Light testing for maximum throughput and stable operation of this profile showed maximum ~500 ms processing intervals with a message size of ~100,000 bytes. This yields around 1200 tags with ~32 char full path names & REST Client Agent publishing in Wide Format with Standard Message Template.
-- Time measured from observation of REST Client Agent HTTP POST to observation of UDD HTTP ACK
-- REST Client Agent configured to publish on Interval at 10 ms in Wide Format using default Standard Message Template
-- Specs used for testing: Kepware Server 6.14.263 - Windows 11 - i7-12800H