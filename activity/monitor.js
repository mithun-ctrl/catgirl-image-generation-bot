const os = require('os');
const { performance } = require('perf_hooks');

class BotMonitor {
    constructor() {
        this.startTime = performance.now();
        this.metrics = {
            totalMessages: 0,
            imagesSent: 0,
            errorCount: 0
        };
    }

    // Calculate uptime
    getUptime() {
        const currentTime = performance.now();
        const uptimeMs = currentTime - this.startTime;
        
        const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    // Get system resource usage
    getSystemResources() {
        const cpuUsage = os.cpus();
        const totalCpuUsage = cpuUsage.reduce((acc, cpu) => {
            acc.user += cpu.times.user;
            acc.nice += cpu.times.nice;
            acc.sys += cpu.times.sys;
            acc.idle += cpu.times.idle;
            return acc;
        }, { user: 0, nice: 0, sys: 0, idle: 0 });

        const totalCpuTime = Object.values(totalCpuUsage).reduce((a, b) => a + b, 0);
        const cpuUsagePercentage = 100 - (totalCpuUsage.idle / totalCpuTime * 100);

        return {
            cpuUsage: cpuUsagePercentage.toFixed(2) + '%',
            memoryUsage: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
            totalMemory: `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`,
            freeMemory: `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`
        };
    }

    // Track message metrics
    incrementMessageCount(type) {
        switch(type) {
            case 'message':
                this.metrics.totalMessages++;
                break;
            case 'image':
                this.metrics.imagesSent++;
                break;
            case 'error':
                this.metrics.errorCount++;
                break;
        }
    }

    // Generate monitoring report
    generateReport() {
        const resources = this.getSystemResources();
        return `🤖 Bot Monitoring Report:
✅ Uptime: ${this.getUptime()}
📊 Metrics:
  • Total Messages: ${this.metrics.totalMessages}
  • Images Sent: ${this.metrics.imagesSent}
  • Errors: ${this.metrics.errorCount}

💻 System Resources:
  • CPU Usage: ${resources.cpuUsage}
  • Process Memory: ${resources.memoryUsage}
  • Total Memory: ${resources.totalMemory}
  • Free Memory: ${resources.freeMemory}`;
    }
}

module.exports = new BotMonitor();