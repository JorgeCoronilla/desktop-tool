"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskState = void 0;
var TaskState;
(function (TaskState) {
    TaskState["IDLE"] = "idle";
    TaskState["IN_PROGRESS"] = "in_progress";
    TaskState["AWAITING_CONFIRMATION"] = "awaiting_confirmation";
    TaskState["COMPLETED"] = "completed";
    TaskState["FAILED"] = "failed";
})(TaskState || (exports.TaskState = TaskState = {}));
