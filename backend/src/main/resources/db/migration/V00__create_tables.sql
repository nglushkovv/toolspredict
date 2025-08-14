create table if not exists public.employee (
    id bigserial primary key,
    surname varchar(255),
    name varchar(255),
    patronymic varchar(255)
);

create table if not exists public.processing_jobs (
    id bigserial primary key,
    employee_id bigint,
    status varchar(255),
    create_date timestamp,
    last_modified timestamp,
    constraint fk_employee_id foreign key (employee_id) references employee(id)
);

create table if not exists public.minio_file (
    id bigserial primary key,
    package_id bigint,
    created_at timestamp,
    bucket_name varchar(255),
    file_path varchar(255),
    file_name varchar(255),
    constraint fk_package_id foreign key (package_id) references processing_jobs(id)
);