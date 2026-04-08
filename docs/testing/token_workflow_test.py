#!/usr/bin/env python3
"""
AI 工作流 Token 消耗自动化测试脚本

功能：
1. 接受提示词和执行次数输入
2. 每次迭代创建独立的测试文档，隔离执行
3. 记录每个工作流的 Token 消耗
4. 执行完成后计算统计指标
5. 自动清理测试文档

用法：
    python token_workflow_test.py

依赖：
    pip install requests tqdm
"""

import requests
import json
import time
import statistics
import sys
from datetime import datetime
from typing import Optional, Dict, List, Any

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None


class TokenWorkflowTester:
    """AI 工作流 Token 消耗测试器"""

    def __init__(
        self,
        base_url: str = "http://localhost:8000/api/v1",
        model: str = "deepseek-ai/DeepSeek-V3",
        max_iterations: int = 10,
        timeout: int = 300
    ):
        """
        初始化测试器

        Args:
            base_url: API 服务地址
            model: 使用的 AI 模型
            max_iterations: 工作流最大迭代次数
            timeout: 请求超时时间（秒）
        """
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.max_iterations = max_iterations
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

        self.results: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []

    def _log(self, message: str, level: str = "INFO"):
        """带时间戳的日志输出"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def _validate_positive_int(self, value: int, name: str = "值") -> None:
        """验证正整数"""
        if not isinstance(value, int) or value <= 0:
            raise ValueError(f"{name} 必须是正整数")

    def check_connection(self) -> bool:
        """检查 API 连接"""
        try:
            response = self.session.get(f"{self.base_url}/documents/", timeout=5)
            return response.status_code == 200
        except requests.RequestException as e:
            self._log(f"API 连接失败: {e}", "ERROR")
            return False

    def create_test_document(self, title: str = "Token消耗测试") -> Optional[str]:
        """
        创建测试文档

        Args:
            title: 文档标题

        Returns:
            文档 ID，失败返回 None
        """
        try:
            response = self.session.post(
                f"{self.base_url}/documents/",
                json={"title": title, "content": "# Token消耗测试文档\n\n初始内容。"},
                timeout=10
            )
            if response.status_code == 200:
                doc = response.json()
                self._log(f"创建测试文档成功: {doc['id']}")
                return doc["id"]
            else:
                self._log(f"创建文档失败: {response.status_code} - {response.text}", "ERROR")
                return None
        except requests.RequestException as e:
            self._log(f"创建文档异常: {e}", "ERROR")
            return None

    def delete_document(self, document_id: str) -> bool:
        """
        删除测试文档（软删除）

        Args:
            document_id: 文档 ID

        Returns:
            是否成功
        """
        try:
            response = self.session.delete(
                f"{self.base_url}/documents/{document_id}",
                timeout=10
            )
            if response.status_code in [200, 204]:
                self._log(f"删除文档成功: {document_id}")
                return True
            else:
                self._log(f"删除文档失败: {response.status_code} - {response.text}", "WARNING")
                return False
        except requests.RequestException as e:
            self._log(f"删除文档异常: {e}", "ERROR")
            return False

    def execute_workflow(
        self,
        user_request: str,
        document_id: str
    ) -> Dict[str, Any]:
        """
        执行工作流并获取 Token 消耗

        Args:
            user_request: 用户提示词
            document_id: 文档 ID

        Returns:
            执行结果，包含 Token 消耗等
        """
        result = {
            "workflow_id": None,
            "success": False,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "request_count": 0,
            "duration": 0,
            "error": None,
            "iterations": 0
        }

        start_time = time.time()

        try:
            url = f"{self.base_url}/workflow/execute-v2"
            params = {
                "user_request": user_request,
                "document_id": document_id,
                "model": self.model,
                "max_iterations": self.max_iterations
            }

            self._log(f"开始执行工作流...")

            response = self.session.get(
                url,
                params=params,
                stream=True,
                timeout=self.timeout
            )

            if response.status_code != 200:
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                return result

            last_workflow_id = None

            for line in response.iter_lines():
                if not line:
                    continue

                try:
                    line = line.decode("utf-8")
                    if not line.startswith("data: "):
                        continue

                    json_str = line[6:]
                    data = json.loads(json_str)

                    if data.get("type") == "complete":
                        result["success"] = True
                        result["iterations"] = data.get("result", {}).get("iterations", 0)
                        result["workflow_id"] = data.get("result", {}).get("workflow_id")
                        last_workflow_id = result["workflow_id"]

                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue

            result["duration"] = time.time() - start_time

            if not last_workflow_id:
                self._log("未能获取 workflow_id，尝试通过时间匹配获取 Token 数据", "WARNING")
                time.sleep(0.5)
                token_response = self.session.get(
                    f"{self.base_url}/token-usage/",
                    params={"limit": 100},
                    timeout=10
                )
                if token_response.status_code == 200:
                    all_tokens = token_response.json()
                    recent_tokens = [
                        t for t in all_tokens
                        if t.get("workflow_id") and
                        (datetime.now() - datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))).total_seconds() < result["duration"] + 5
                    ]
                    result["request_details"] = []
                    for t in recent_tokens:
                        prompt_t = t.get("prompt_tokens", 0)
                        completion_t = t.get("completion_tokens", 0)
                        total_t = t.get("total_tokens", 0)
                        result["prompt_tokens"] += prompt_t
                        result["completion_tokens"] += completion_t
                        result["total_tokens"] += total_t
                        result["request_count"] += 1
                        result["request_details"].append({
                            "prompt": prompt_t,
                            "completion": completion_t,
                            "total": total_t
                        })
            else:
                self._log(f"获取到 workflow_id: {last_workflow_id}")
                time.sleep(0.5)
                token_response = self.session.get(
                    f"{self.base_url}/token-usage/workflow/{last_workflow_id}",
                    timeout=10
                )
                if token_response.status_code == 200:
                    workflow_tokens = token_response.json()
                    result["request_details"] = []
                    for t in workflow_tokens:
                        prompt_t = t.get("prompt_tokens", 0)
                        completion_t = t.get("completion_tokens", 0)
                        total_t = t.get("total_tokens", 0)
                        result["prompt_tokens"] += prompt_t
                        result["completion_tokens"] += completion_t
                        result["total_tokens"] += total_t
                        result["request_count"] += 1
                        result["request_details"].append({
                            "prompt": prompt_t,
                            "completion": completion_t,
                            "total": total_t
                        })
                else:
                    self._log(f"获取 Token 数据失败: {token_response.status_code}", "WARNING")

            self._log(
                f"工作流执行完成: {result['total_tokens']} tokens, "
                f"{result['request_count']} 次请求, 耗时 {result['duration']:.1f}s"
            )
            if result.get("request_details"):
                for i, req in enumerate(result["request_details"]):
                    self._log(f"  请求 {i+1}: prompt={req['prompt']}, completion={req['completion']}, total={req['total']}")

        except requests.Timeout:
            result["error"] = "请求超时"
            self._log("工作流执行超时", "ERROR")
        except requests.RequestException as e:
            result["error"] = str(e)
            self._log(f"工作流执行异常: {e}", "ERROR")
        except Exception as e:
            result["error"] = f"未知错误: {e}"
            self._log(f"工作流执行失败: {e}", "ERROR")

        return result

    def run_test(
        self,
        user_request: str,
        runs: int = 5,
        cleanup: bool = True,
        batch_count: int = 1
    ) -> Dict[str, Any]:
        """
        运行测试

        Args:
            user_request: 测试用的提示词
            runs: 每批次执行次数
            cleanup: 是否自动清理文档
            batch_count: 批次数量

        Returns:
            测试结果统计
        """
        self._validate_positive_int(runs, "执行次数")
        self._validate_positive_int(batch_count, "批次数量")
        total_runs = runs * batch_count
        self._log(f"=" * 60)
        self._log(f"开始 Token 消耗测试")
        self._log(f"提示词: {user_request[:50]}...")
        self._log(f"执行次数: {runs} 次/批次 x {batch_count} 批次 = {total_runs} 次")
        self._log(f"模型: {self.model}")
        self._log(f"=" * 60)

        if not self.check_connection():
            self._log("API 连接检查失败，请确保后端服务运行中", "ERROR")
            return {"success": False, "error": "API 连接失败"}

        self.results = []
        self.errors = []
        batch_results = []

        for batch_num in range(batch_count):
            self._log(f"\n{'=' * 60}")
            self._log(f"批次 {batch_num + 1}/{batch_count}")
            self._log(f"{'=' * 60}")

            batch_run_results = []
            iterator = range(runs)
            if tqdm:
                iterator = tqdm(iterator, desc=f"批次{batch_num + 1}进度")

            for i in iterator:
                run_num = batch_num * runs + i + 1
                self._log(f"-" * 40)
                self._log(f"开始第 {run_num}/{total_runs} 次测试 (批次{batch_num + 1}内第{i + 1}次)")

                doc_id = self.create_test_document(f"Token消耗测试-B{batch_num + 1}-R{i + 1}")
                if not doc_id:
                    self.errors.append({"run": run_num, "error": "创建文档失败"})
                    self._log(f"第 {run_num} 次测试失败: 无法创建文档", "ERROR")
                    continue

                result = self.execute_workflow(user_request, doc_id)
                result["run"] = run_num
                result["batch"] = batch_num + 1
                result["document_id"] = doc_id
                self.results.append(result)
                batch_run_results.append(result)

                if result["error"]:
                    self.errors.append({"run": run_num, "error": result["error"]})

                if cleanup:
                    if self.delete_document(doc_id):
                        self._log(f"文档 {doc_id} 已清理")
                    else:
                        self._log(f"文档清理失败，可能影响下次测试", "WARNING")

            batch_summary = self._calculate_batch_summary(batch_run_results)
            batch_results.append({
                "batch": batch_num + 1,
                "summary": batch_summary
            })

        summary = self.generate_summary(batch_results)
        self.print_summary(summary)

        return summary

    def _calculate_batch_summary(self, batch_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """计算单批次统计"""
        if not batch_results:
            return {}

        successful = [r for r in batch_results if r["success"]]
        if not successful:
            return {"success": False}

        total_tokens = [r["total_tokens"] for r in successful]
        prompt_tokens = [r["prompt_tokens"] for r in successful]
        completion_tokens = [r["completion_tokens"] for r in successful]
        durations = [r["duration"] for r in successful]

        return {
            "success": True,
            "count": len(successful),
            "total_tokens_avg": statistics.mean(total_tokens),
            "total_tokens_min": min(total_tokens),
            "total_tokens_max": max(total_tokens),
            "total_tokens_stdev": statistics.stdev(total_tokens) if len(total_tokens) > 1 else 0,
            "prompt_tokens_avg": statistics.mean(prompt_tokens),
            "completion_tokens_avg": statistics.mean(completion_tokens),
            "duration_avg": statistics.mean(durations)
        }

    def generate_summary(self, batch_results: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """生成统计报告"""
        if batch_results is None:
            batch_results = []

        successful_results = [r for r in self.results if r["success"]]

        if not successful_results:
            return {
                "success": False,
                "error": "所有测试均失败",
                "total_runs": len(self.results),
                "successful_runs": 0,
                "failed_runs": len(self.results),
                "results": self.results
            }

        total_tokens = [r["total_tokens"] for r in successful_results]
        prompt_tokens = [r["prompt_tokens"] for r in successful_results]
        completion_tokens = [r["completion_tokens"] for r in successful_results]
        durations = [r["duration"] for r in successful_results]

        batch_summaries = []
        if batch_results:
            batch_totals = [b["summary"]["total_tokens_avg"] for b in batch_results if b["summary"].get("success")]
            if batch_totals:
                batch_summaries = {
                    "avg_across_batches": statistics.mean(batch_totals),
                    "stdev_across_batches": statistics.stdev(batch_totals) if len(batch_totals) > 1 else 0,
                    "batches": batch_results
                }

        return {
            "success": True,
            "total_runs": len(self.results),
            "successful_runs": len(successful_results),
            "failed_runs": len(self.results) - len(successful_results),
            "total_tokens": {
                "sum": sum(total_tokens),
                "avg": statistics.mean(total_tokens),
                "min": min(total_tokens),
                "max": max(total_tokens),
                "stdev": statistics.stdev(total_tokens) if len(total_tokens) > 1 else 0
            },
            "prompt_tokens": {
                "avg": statistics.mean(prompt_tokens),
                "min": min(prompt_tokens),
                "max": max(prompt_tokens)
            },
            "completion_tokens": {
                "avg": statistics.mean(completion_tokens),
                "min": min(completion_tokens),
                "max": max(completion_tokens)
            },
            "duration": {
                "avg": statistics.mean(durations),
                "min": min(durations),
                "max": max(durations),
                "total": sum(durations)
            },
            "batch_summaries": batch_summaries,
            "results": self.results,
            "errors": self.errors
        }

    def print_summary(self, summary: Dict[str, Any]) -> None:
        """打印统计报告"""
        self._log("=" * 60)
        self._log("测试完成 - 统计报告")
        self._log("=" * 60)

        self._log(f"总执行次数: {summary.get('total_runs', 0)}")
        self._log(f"成功次数: {summary.get('successful_runs', 0)}")
        self._log(f"失败次数: {summary.get('failed_runs', 0)}")

        if not summary.get("success"):
            self._log(f"错误: {summary.get('error', '未知错误')}", "ERROR")
            return

        total_tokens = summary.get("total_tokens", {})
        prompt_tokens = summary.get("prompt_tokens", {})
        completion_tokens = summary.get("completion_tokens", {})

        self._log("-" * 40)
        self._log("Token 消耗统计")
        self._log("-" * 40)
        self._log(f"总 Token 数:   {total_tokens.get('sum', 0):,.0f}")
        self._log(f"平均 Token 数: {total_tokens.get('avg', 0):,.2f}")
        self._log(f"最小 Token 数: {total_tokens.get('min', 0):,.0f}")
        self._log(f"最大 Token 数: {total_tokens.get('max', 0):,.0f}")
        self._log(f"标准差:        {total_tokens.get('stdev', 0):,.2f}")

        if summary.get("batch_summaries") and summary["batch_summaries"].get("batches"):
            bs = summary["batch_summaries"]
            self._log("-" * 40)
            self._log("批次统计")
            self._log("-" * 40)
            self._log(f"批次间平均值: {bs.get('avg_across_batches', 0):,.2f}")
            self._log(f"批次间标准差: {bs.get('stdev_across_batches', 0):,.2f}")
            for b in bs["batches"]:
                if b["summary"].get("success"):
                    s = b["summary"]
                    self._log(
                        f"  批次 {b['batch']}: 均值={s.get('total_tokens_avg', 0):,.0f}, "
                        f"范围=[{s.get('total_tokens_min', 0):,.0f}-{s.get('total_tokens_max', 0):,.0f}], "
                        f"批次内标准差={s.get('total_tokens_stdev', 0):,.0f}"
                    )

        self._log("-" * 40)
        self._log("输入 Token (Prompt)")
        self._log(f"平均: {prompt_tokens.get('avg', 0):,.2f}")
        self._log(f"最小: {prompt_tokens.get('min', 0):,.0f}")
        self._log(f"最大: {prompt_tokens.get('max', 0):,.0f}")

        self._log("-" * 40)
        self._log("输出 Token (Completion)")
        self._log(f"平均: {completion_tokens.get('avg', 0):,.2f}")
        self._log(f"最小: {completion_tokens.get('min', 0):,.0f}")
        self._log(f"最大: {completion_tokens.get('max', 0):,.0f}")

        self._log("-" * 40)
        self._log("执行时间")
        duration = summary.get("duration", {})
        self._log(f"总耗时:   {duration.get('total', 0):.1f}s")
        self._log(f"平均耗时: {duration.get('avg', 0):.1f}s")
        self._log(f"最快:     {duration.get('min', 0):.1f}s")
        self._log(f"最慢:     {duration.get('max', 0):.1f}s")

        if summary.get("errors"):
            self._log("-" * 40)
            self._log("错误详情")
            for err in summary["errors"]:
                self._log(f"  第 {err['run']} 次: {err['error']}", "ERROR")

        self._log("=" * 60)


def get_user_input() -> tuple[str, int, int]:
    """
    获取用户输入

    Returns:
        (提示词, 执行次数, 批次数量)
    """
    print("\n" + "=" * 60)
    print("AI 工作流 Token 消耗自动化测试")
    print("=" * 60)

    print("\n请输入测试提示词（回车使用默认）:")
    print("示例: 请帮我完成以下任务：1. 在文档末尾添加一段关于\"软件设计模式\"的介绍 2. 在\"概述\"标题下添加一段背景说明")
    default_prompt = "请帮我完成以下任务：1. 在文档末尾添加一段关于\"软件设计模式\"的介绍 2. 在\"概述\"标题下添加一段背景说明"
    user_prompt = input(f"\n提示词 [{default_prompt[:30]}...]: ").strip()

    if not user_prompt:
        user_prompt = default_prompt

    while True:
        try:
            runs_str = input("\n输入每批次执行次数（正整数，默认5）: ").strip()
            if not runs_str:
                runs = 5
                break
            runs = int(runs_str)
            if runs <= 0:
                print("错误: 执行次数必须是正整数")
                continue
            break
        except ValueError:
            print("错误: 请输入有效的数字")

    while True:
        try:
            batch_str = input("\n输入批次数量（正整数，默认3）: ").strip()
            if not batch_str:
                batch_count = 3
                break
            batch_count = int(batch_str)
            if batch_count <= 0:
                print("错误: 批次数量必须是正整数")
                continue
            break
        except ValueError:
            print("错误: 请输入有效的数字")

    return user_prompt, runs, batch_count


def main():
    """主函数"""
    prompt, runs, batch_count = get_user_input()

    print("\n" + "-" * 40)
    print("可选配置（直接回车使用默认值）:")
    api_url = input("API 地址 [http://localhost:8000/api/v1]: ").strip()
    if not api_url:
        api_url = "http://localhost:8000/api/v1"

    model = input("模型 [deepseek-ai/DeepSeek-V3]: ").strip()
    if not model:
        model = "deepseek-ai/DeepSeek-V3"

    try:
        max_iterations = int(input("最大迭代次数 [10]: ").strip() or "10")
    except ValueError:
        max_iterations = 10

    tester = TokenWorkflowTester(
        base_url=api_url,
        model=model,
        max_iterations=max_iterations
    )

    print("\n" + "-" * 40)
    summary = tester.run_test(prompt, runs=runs, cleanup=True, batch_count=batch_count)

    if summary.get("success"):
        print("\n测试成功完成！")
        sys.exit(0)
    else:
        print("\n测试完成但有问题，请检查上方错误信息")
        sys.exit(1)


if __name__ == "__main__":
    main()
