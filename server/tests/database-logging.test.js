// Database Logging Integration Test
// Tests the complete logging system integration

const mongoose = require("mongoose");
const databaseLogger = require("../utils/databaseLogger");
const ApplicationLog = require("../models/ApplicationLog");

console.log("🔍 OLYMPIA DATABASE LOGGING INTEGRATION TEST");
console.log("============================================");

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    testResults.tests.push({ name: message, status: "PASSED" });
    console.log(`✅ PASS: ${message}`);
  } else {
    testResults.failed++;
    testResults.tests.push({ name: message, status: "FAILED" });
    console.log(`❌ FAIL: ${message}`);
  }
}

function assertTrue(condition, message) {
  assert(condition === true, message);
}

async function connectToDatabase() {
  try {
    // Load environment variables
    require("dotenv").config();

    // Use the same MongoDB connection as the main app
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      return false;
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to test database");
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to database:", error.message);
    return false;
  }
}

async function cleanupTestData() {
  try {
    // Clean up test logs
    await ApplicationLog.deleteMany({
      $or: [
        { message: { $regex: /TEST_LOG_/ } },
        { category: "test" },
        { source: "logging-test" },
      ],
    });
    console.log("🧹 Cleaned up test data");
  } catch (error) {
    console.error("❌ Failed to cleanup test data:", error);
  }
}

async function testBasicLogging() {
  console.log("\n📝 Testing Basic Logging Functions...");

  try {
    // Test system logging
    await databaseLogger.logSystem("TEST_LOG_SYSTEM", {
      testData: "system test",
      timestamp: new Date(),
    });

    // Test error logging
    const testError = new Error("Test error message");
    await databaseLogger.logError("TEST_LOG_ERROR", testError);

    // Test security logging
    await databaseLogger.logSecurity("TEST_LOG_SECURITY", "medium", {
      testData: "security test",
    });

    // Test audit logging
    await databaseLogger.logAudit("TEST_LOG_AUDIT", {
      testData: "audit test",
    });

    // Test performance logging
    await databaseLogger.logPerformance("TEST_LOG_PERFORMANCE", 1500, {
      testData: "performance test",
    });

    // Test API logging
    await databaseLogger.logAPI("TEST_LOG_API", {
      method: "GET",
      url: "/test",
      statusCode: 200,
    });

    // Test database logging
    await databaseLogger.logDatabase("TEST_LOG_DATABASE", "testCollection", {
      operation: "find",
      duration: 50,
    });

    assertTrue(true, "All basic logging functions executed without errors");
  } catch (error) {
    console.error("Basic logging test error:", error);
    assert(false, "Basic logging functions should work correctly");
  }
}

async function testLogRetrieval() {
  console.log("\n🔍 Testing Log Retrieval...");

  try {
    // Wait a moment for logs to be saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test finding system logs
    const systemLogs = await ApplicationLog.find({
      message: "TEST_LOG_SYSTEM",
      category: "system",
    });
    assertTrue(systemLogs.length > 0, "System logs should be retrievable");

    // Test finding error logs
    const errorLogs = await ApplicationLog.find({
      message: "TEST_LOG_ERROR",
      level: "error",
    });
    assertTrue(errorLogs.length > 0, "Error logs should be retrievable");

    // Test finding security logs
    const securityLogs = await ApplicationLog.find({
      message: "TEST_LOG_SECURITY",
      category: "security",
    });
    assertTrue(securityLogs.length > 0, "Security logs should be retrievable");

    // Test log metadata
    if (systemLogs.length > 0) {
      const log = systemLogs[0];
      assertTrue(!!log.createdAt, "Logs should have creation timestamp");
      assertTrue(!!log.level, "Logs should have level");
      assertTrue(!!log.category, "Logs should have category");
      assertTrue(!!log.metadata, "Logs should have metadata");
    }
  } catch (error) {
    console.error("Log retrieval test error:", error);
    assert(false, "Log retrieval should work correctly");
  }
}

async function testLogAnalytics() {
  console.log("\n📊 Testing Log Analytics...");

  try {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endDate = new Date();

    // Test log statistics
    const stats = await ApplicationLog.getLogStats({ startDate, endDate });
    assertTrue(Array.isArray(stats), "Log stats should return an array");

    // Test error patterns (if method exists)
    if (typeof ApplicationLog.getErrorPatterns === "function") {
      const errorPatterns = await ApplicationLog.getErrorPatterns({
        startDate,
      });
      assertTrue(
        Array.isArray(errorPatterns),
        "Error patterns should return an array"
      );
    }

    // Test search functionality
    const searchOptions = {
      query: "TEST_LOG",
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: -1,
    };

    const searchResults = await ApplicationLog.searchLogs(searchOptions);
    assertTrue(!!searchResults, "Search should return results");
    assertTrue(
      Array.isArray(searchResults.logs),
      "Search should return logs array"
    );
    assertTrue(
      typeof searchResults.totalCount === "number",
      "Search should return total count"
    );
  } catch (error) {
    console.error("Log analytics test error:", error);
    assert(false, "Log analytics should work correctly");
  }
}

async function testLogCleanup() {
  console.log("\n🧹 Testing Log Cleanup...");

  try {
    // Create old test log
    const oldLog = new ApplicationLog({
      level: "info",
      message: "OLD_TEST_LOG",
      category: "test",
      source: "logging-test",
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
    });
    await oldLog.save();

    // Count logs before cleanup
    const beforeCount = await ApplicationLog.countDocuments({
      message: "OLD_TEST_LOG",
    });
    assertTrue(beforeCount > 0, "Old test log should be created");

    // Test manual cleanup (simulate TTL behavior)
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const deleteResult = await ApplicationLog.deleteMany({
      message: "OLD_TEST_LOG",
      createdAt: { $lt: cutoffDate },
    });

    assertTrue(deleteResult.deletedCount > 0, "Old logs should be deleted");

    // Verify cleanup
    const afterCount = await ApplicationLog.countDocuments({
      message: "OLD_TEST_LOG",
    });
    assertTrue(afterCount === 0, "Old logs should be cleaned up");
  } catch (error) {
    console.error("Log cleanup test error:", error);
    assert(false, "Log cleanup should work correctly");
  }
}

async function testConcurrentLogging() {
  console.log("\n⚡ Testing Concurrent Logging...");

  try {
    const promises = [];

    // Create 20 concurrent log operations
    for (let i = 0; i < 20; i++) {
      promises.push(
        databaseLogger.logSystem(`CONCURRENT_TEST_${i}`, {
          testNumber: i,
          timestamp: new Date(),
        })
      );
    }

    await Promise.all(promises);

    // Wait for logs to be saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify all logs were saved
    const concurrentLogs = await ApplicationLog.find({
      message: { $regex: /CONCURRENT_TEST_/ },
    });

    assertTrue(
      concurrentLogs.length === 20,
      "All concurrent logs should be saved"
    );

    // Clean up concurrent test logs
    await ApplicationLog.deleteMany({
      message: { $regex: /CONCURRENT_TEST_/ },
    });
  } catch (error) {
    console.error("Concurrent logging test error:", error);
    assert(false, "Concurrent logging should work correctly");
  }
}

async function testPerformance() {
  console.log("\n⚡ Testing Logging Performance...");

  try {
    const startTime = Date.now();

    // Log 100 entries
    for (let i = 0; i < 100; i++) {
      await databaseLogger.logSystem(`PERFORMANCE_TEST_${i}`, {
        testNumber: i,
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `📊 Logged 100 entries in ${duration}ms (${(duration / 100).toFixed(
        2
      )}ms per log)`
    );

    assertTrue(
      duration < 10000,
      `Performance test: ${duration}ms for 100 logs should be under 10 seconds`
    );

    // Clean up performance test logs
    await ApplicationLog.deleteMany({
      message: { $regex: /PERFORMANCE_TEST_/ },
    });
  } catch (error) {
    console.error("Performance test error:", error);
    assert(false, "Performance logging should be fast enough");
  }
}

async function runDatabaseLoggingTests() {
  const startTime = Date.now();

  try {
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
      console.error("❌ Cannot connect to database - tests aborted");
      process.exit(1);
    }

    // Clean up any existing test data
    await cleanupTestData();

    // Run all tests
    await testBasicLogging();
    await testLogRetrieval();
    await testLogAnalytics();
    await testLogCleanup();
    await testConcurrentLogging();
    await testPerformance();

    // Final cleanup
    await cleanupTestData();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Print results
    console.log("\n============================================");
    console.log("📊 DATABASE LOGGING TEST RESULTS");
    console.log("============================================");
    console.log(`✅ Tests Passed: ${testResults.passed}`);
    console.log(`❌ Tests Failed: ${testResults.failed}`);
    console.log(
      `📈 Success Rate: ${(
        (testResults.passed / (testResults.passed + testResults.failed)) *
        100
      ).toFixed(2)}%`
    );
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log("============================================");

    if (testResults.failed > 0) {
      console.log("\n❌ FAILED TESTS:");
      testResults.tests
        .filter((test) => test.status === "FAILED")
        .forEach((test) => console.log(`   - ${test.name}`));
    } else {
      console.log(
        "\n🎉 ALL DATABASE LOGGING TESTS PASSED! System is working correctly.\n"
      );
    }

    // Close database connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");

    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n💥 CRITICAL TEST ERROR:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDatabaseLoggingTests();
}

module.exports = {
  runDatabaseLoggingTests,
  testResults,
};
