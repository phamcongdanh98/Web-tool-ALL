# AGENTS.md — {{PROJECT_NAME}}

> Đây là template. Trước khi sử dụng, thay mọi giá trị `{{PLACEHOLDER}}`, xóa phần không áp dụng và chỉ giữ câu lệnh đã được xác nhận trong repository.

## 1. Vai trò và phạm vi hướng dẫn

File này là bộ nhớ vận hành dành cho Codex và người phát triển `{{PROJECT_NAME}}`. Trước mỗi công việc, đọc file này cùng `{{PRIMARY_PROJECT_DOCS}}`, kiểm tra trạng thái repository và đối chiếu mã nguồn hiện tại.

Hướng dẫn trong file `AGENTS.md` nằm sâu hơn trong cây thư mục được ưu tiên cho phạm vi của thư mục đó. Yêu cầu trực tiếp của người dùng vẫn quyết định mục tiêu của công việc.

Không dựa vào trí nhớ của phiên trước nếu repository hoặc tài liệu đã thay đổi.

## 2. Hồ sơ dự án

| Thuộc tính | Giá trị |
| --- | --- |
| Mục tiêu | {{PROJECT_GOAL}} |
| Phạm vi | {{PROJECT_SCOPE}} |
| Không thuộc phạm vi | {{PROJECT_NON_GOALS}} |
| Tính năng chưa triển khai | {{UNIMPLEMENTED_FEATURES}} |
| Runtime tối thiểu | {{RUNTIME_REQUIREMENT}} |
| Package/build tool | {{PACKAGE_OR_BUILD_TOOL}} |
| Lockfile | {{LOCKFILE_OR_NOT_APPLICABLE}} |
| Nhánh chuẩn | {{SOURCE_BRANCH}} |
| Nguồn code chuẩn | {{SOURCE_OF_TRUTH}} |
| Local | {{LOCAL_ENVIRONMENT}} |
| Staging | {{STAGING_ENVIRONMENT_OR_NONE}} |
| Production | {{PRODUCTION_ENVIRONMENT_OR_NONE}} |
| Health/readiness | {{HEALTH_ENDPOINT_OR_COMMAND}} |

Chỉ mô tả một tính năng là hoạt động khi đã kiểm tra đường đi thật và đầu ra quan sát được. Tính năng chưa có triển khai đầy đủ phải được ghi rõ; không dùng fallback giả hoặc thông báo thành công để che phần còn thiếu.

## 3. Kiến trúc và trách nhiệm

| Đường dẫn/thành phần | Trách nhiệm | Không nên đặt ở đây |
| --- | --- | --- |
| `{{ENTRYPOINT_PATH}}` | {{ENTRYPOINT_RESPONSIBILITY}} | {{ENTRYPOINT_BOUNDARY}} |
| `{{FRONTEND_OR_INTERFACE_PATH}}` | {{FRONTEND_RESPONSIBILITY}} | {{FRONTEND_BOUNDARY}} |
| `{{BACKEND_OR_CORE_PATH}}` | {{BACKEND_RESPONSIBILITY}} | {{BACKEND_BOUNDARY}} |
| `{{DATA_OR_STORAGE_PATH}}` | {{DATA_RESPONSIBILITY}} | {{DATA_BOUNDARY}} |
| `{{TEST_PATH}}` | {{TEST_RESPONSIBILITY}} | Dữ liệu thật hoặc secret |
| `{{DEPLOY_PATH}}` | {{DEPLOY_RESPONSIBILITY}} | Credential hoặc cấu hình cá nhân |

### Ranh giới hệ thống

- Input/trust boundary: {{INPUT_AND_TRUST_BOUNDARIES}}.
- Dữ liệu lưu trữ: {{PERSISTED_DATA_AND_OWNER}}.
- Dịch vụ bên ngoài: {{EXTERNAL_SERVICES}}.
- Artifact/đầu ra: {{OUTPUT_ARTIFACTS}}.
- Giới hạn tài nguyên: {{SIZE_RATE_MEMORY_TIMEOUT_LIMITS}}.

## 4. Luồng xử lý quan trọng

### 4.1. Luồng chính

```text
{{USER_OR_CALLER}}
  → {{INPUT_STEP}}
  → {{VALIDATION_STEP}}
  → {{CORE_PROCESSING_STEP}}
  → {{PERSISTENCE_OR_EXTERNAL_STEP}}
  → {{OUTPUT_STEP}}
  → {{OUTPUT_VERIFICATION_STEP}}
```

Thành công nghĩa là: {{PRIMARY_SUCCESS_CRITERIA}}.

### 4.2. Luồng lỗi

```text
Input/lỗi phụ thuộc
  → phát hiện tại {{ERROR_DETECTION_BOUNDARY}}
  → trả {{SAFE_ERROR_CONTRACT}}
  → ghi log tại {{LOG_LOCATION}}
  → cleanup/rollback {{CLEANUP_OR_ROLLBACK}}
```

- Lỗi người dùng có thể sửa: {{USER_CORRECTABLE_ERRORS}}.
- Lỗi hệ thống cần điều tra: {{SYSTEM_ERRORS}}.
- Không được lộ trong response/log: {{SENSITIVE_ERROR_DATA}}.

### 4.3. Luồng bổ sung cần bảo vệ

Mô tả riêng các luồng như đăng nhập, thanh toán, upload/download, background job, migration, đồng bộ hoặc deploy nếu chúng tồn tại:

{{ADDITIONAL_CRITICAL_FLOWS}}

## 5. Hợp đồng dữ liệu và an toàn

- Schema/API contract chuẩn: {{SCHEMA_OR_API_SOURCE}}.
- Quy tắc validation: {{VALIDATION_RULES}}.
- Quy tắc version/migration: {{VERSIONING_OR_MIGRATION_RULES}}.
- Backup trước thao tác rủi ro: {{BACKUP_RULES}}.
- Retention/cleanup: {{RETENTION_AND_CLEANUP}}.
- Idempotency/concurrency: {{IDEMPOTENCY_AND_CONCURRENCY}}.
- Secret chỉ nằm tại: {{SECRET_STORAGE}}; repository chỉ giữ file mẫu không có giá trị thật.

Không chạy migration phá hủy, xóa dữ liệu, reset repository hoặc thay đổi production nếu chưa có phạm vi rõ, backup/rollback phù hợp và quyền của người dùng.

## 6. Ma trận lệnh chuẩn

Chỉ giữ lệnh có thật. Nếu dự án chưa có một cổng, ghi `Chưa cấu hình` để tránh tạo cảm giác kiểm thử đầy đủ.

| Mục đích | Lệnh | Khi dùng/đầu ra mong đợi |
| --- | --- | --- |
| Cài dependency khóa cứng | `{{INSTALL_COMMAND}}` | {{INSTALL_EXPECTATION}} |
| Chạy local | `{{DEV_COMMAND}}` | {{DEV_EXPECTATION}} |
| Format | `{{FORMAT_COMMAND_OR_NOT_CONFIGURED}}` | {{FORMAT_EXPECTATION}} |
| Lint | `{{LINT_COMMAND_OR_NOT_CONFIGURED}}` | {{LINT_EXPECTATION}} |
| Typecheck | `{{TYPECHECK_COMMAND_OR_NOT_CONFIGURED}}` | {{TYPECHECK_EXPECTATION}} |
| Unit test | `{{UNIT_TEST_COMMAND_OR_NOT_CONFIGURED}}` | {{UNIT_TEST_EXPECTATION}} |
| Integration test | `{{INTEGRATION_COMMAND_OR_NOT_CONFIGURED}}` | {{INTEGRATION_EXPECTATION}} |
| Production build | `{{BUILD_COMMAND}}` | {{BUILD_EXPECTATION}} |
| Smoke test | `{{SMOKE_COMMAND_OR_NOT_CONFIGURED}}` | {{SMOKE_EXPECTATION}} |
| E2E | `{{E2E_COMMAND_OR_NOT_CONFIGURED}}` | {{E2E_EXPECTATION}} |
| Security audit | `{{AUDIT_COMMAND_OR_NOT_CONFIGURED}}` | {{AUDIT_EXPECTATION}} |
| Cổng verify duy nhất | `{{VERIFY_COMMAND_OR_NOT_CONFIGURED}}` | {{VERIFY_EXPECTATION}} |
| Trạng thái hệ thống | `{{STATUS_COMMAND_OR_NOT_CONFIGURED}}` | Chỉ đọc; không thay đổi production |
| Deploy | `{{DEPLOY_COMMAND_OR_NOT_CONFIGURED}}` | Chỉ chạy khi đủ điều kiện phát hành |

`{{VERIFY_COMMAND_OR_NOT_CONFIGURED}}` là cổng chất lượng chuẩn nếu nó tồn tại. Nếu chưa có, chạy các kiểm tra liên quan từ rẻ đến đắt và ghi rõ phần còn thiếu.

## 7. Quy trình bắt đầu công việc

1. Đọc `AGENTS.md`, `{{PRIMARY_PROJECT_DOCS}}` và ghi chú gần nhất.
2. Chạy `{{STATUS_COMMAND}}` trước khi sửa.
3. Nếu có thay đổi lạ hoặc chưa rõ chủ sở hữu, dừng để làm rõ; không reset/xóa/stash tùy tiện.
4. Đồng bộ bằng `{{SAFE_SYNC_COMMAND}}` khi chính sách dự án yêu cầu. Nếu bị chặn bởi thay đổi local, báo rõ thay vì tự xử lý phá hủy.
5. Đồng bộ dependency bằng `{{INSTALL_COMMAND}}` nếu manifest/lockfile thay đổi.
6. Chạy baseline liên quan để phân biệt lỗi có sẵn với regression mới.

## 8. Quy trình triển khai thay đổi

### Thêm hoặc sửa tính năng

1. Xác định hành vi quan sát được, input/output, giới hạn và failure contract.
2. Truy vết những tầng bị ảnh hưởng; tránh refactor ngoài phạm vi.
3. Validate ở trust boundary, không chỉ ở UI/caller.
4. Thêm hoặc cập nhật test gần nguyên nhân nhất.
5. Chạy luồng thật từ input tới output và kiểm tra ý nghĩa của kết quả.
6. Cập nhật tài liệu, env example, schema/migration và changelog khi cần.

### Chẩn đoán lỗi

1. Tái hiện bằng dữ liệu nhỏ, không nhạy cảm.
2. Xác định lỗi nằm ở input, validation, core logic, persistence, integration, response hay presentation.
3. Thu thập log/trạng thái read-only; không sửa trước khi hiểu nguyên nhân.
4. Tạo regression test nếu khả thi.
5. Sửa nguyên nhân gốc, rồi kiểm tra output thực và các invariant liên quan.

### Dependency hoặc cấu hình

- Chỉ thay dependency trong phạm vi yêu cầu; đánh giá maintenance, license, kích thước và advisory.
- Cập nhật lockfile cùng manifest và nhắc máy/môi trường khác cài lại khi cần.
- Chỉ commit file env mẫu; không ghi giá trị thật vào repository, log, ảnh hoặc chat.

### Database/migration

- Dùng migration có phiên bản và chiến lược tương thích ngược phù hợp.
- Backup trước migration phá hủy; xác định rollback và thời gian khóa.
- Không sửa trực tiếp dữ liệu production ngoài quy trình đã được cho phép.

## 9. Cổng chất lượng

Chạy theo mức liên quan, từ rẻ đến đắt:

1. Diff/format/syntax.
2. Lint và typecheck.
3. Unit test.
4. Integration test.
5. Production build.
6. Production smoke: start → readiness/health → route/chức năng chính → shutdown sạch.
7. E2E đường người dùng/caller quan trọng.
8. Security audit và secret review.

Không nói “tất cả test đã qua” nếu một cổng không tồn tại hoặc chưa chạy. Ghi tên lệnh, kết quả và phần chưa được kiểm chứng.

## 10. Git, CI và review

- Nhánh chuẩn: `{{SOURCE_BRANCH}}`; chiến lược branch/PR: {{BRANCH_AND_PR_POLICY}}.
- Trước commit, xem status, diff, file mới và xác nhận không có secret, build output hoặc dữ liệu người dùng.
- Chỉ commit/push khi người dùng yêu cầu. Commit message: {{COMMIT_MESSAGE_CONVENTION}}.
- CI bắt buộc: {{REQUIRED_CI_CHECKS}}.
- Không bypass required checks chỉ để phát hành nhanh.
- Khi làm trên nhiều máy/người, không sửa đồng thời cùng nhánh; Git remote là điểm đồng bộ chuẩn.

Kết thúc công việc phải báo: file đã đổi, kiểm tra đã chạy, phần chưa kiểm tra và trạng thái **chưa commit / đã commit chưa push / đã push**, kèm hash khi có.

## 11. Phát hành và vận hành

Xóa phần này nếu dự án không có môi trường deploy.

- Chỉ deploy artifact/commit đã nằm trong nguồn chuẩn và đã qua CI cần thiết.
- Điều kiện trước deploy: {{DEPLOY_GUARDS}}.
- Cách tạo/chuyển release: {{RELEASE_STRATEGY}}.
- Migration/backup: {{DEPLOY_DATA_STEPS}}.
- Internal health: {{INTERNAL_HEALTH_CHECK}}.
- Public/synthetic check: {{PUBLIC_HEALTH_CHECK}}.
- Log/metrics: {{OBSERVABILITY_LOCATION}}.
- Rollback: {{ROLLBACK_COMMAND_OR_PROCEDURE}}.
- Retention release/artifact: {{RELEASE_RETENTION}}.

Không dùng development server làm production server. Không coi exit code 0 của deploy là bằng chứng duy nhất; xác nhận đúng release và health sau khi chuyển phiên bản.

## 12. Definition of Done

- Phạm vi yêu cầu đã hoàn thành, không trộn thay đổi ngoài phạm vi.
- Input, trust boundary, lỗi và giới hạn tài nguyên được xử lý phù hợp.
- Output mở/parse/quan sát được và giữ đúng invariant nghiệp vụ.
- Test liên quan đã xanh; cổng còn thiếu hoặc chưa chạy được ghi rõ.
- Diff không chứa secret, dữ liệu người dùng, build output hoặc file local.
- Tài liệu, lockfile, env example và migration được cập nhật khi cần.
- Nếu phát hành: CI, release identity, internal/public health, log và rollback path đã được xác nhận.
- Trạng thái Git/push/deploy được báo chính xác.

## 13. Bài học vận hành riêng của dự án

Chỉ ghi những bài học đã được chứng minh và có khả năng thay đổi quyết định tương lai:

- {{LEARNED_INVARIANT_1}}.
- {{LEARNED_INVARIANT_2}}.
- {{LEARNED_INVARIANT_3}}.

Không biến một lỗi đơn lẻ hoặc sở thích cá nhân thành quy tắc chung nếu chưa có rủi ro cụ thể.
