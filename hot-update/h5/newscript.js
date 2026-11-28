// window.bridge.sendToLua("开始加载函数");
const 战斗方法_套数上限 = 8;

function 补齐任务战斗套数选项(根节点) {
    const 查询根节点 = 根节点 || document;
    查询根节点.querySelectorAll('.custom-radio input[data-function="radio"][name*="战斗选择"][id$="_第5套"]').forEach(第五套 => {
        const 原标签 = 第五套.closest('.custom-radio');
        const 选择组 = 原标签.parentElement;
        选择组.classList.add('战斗方案选择组');
        选择组.parentElement.classList.add('战斗方案选择行');

        for (let 套号 = 6; 套号 <= 战斗方法_套数上限; 套号++) {
            const 新单选框ID = 第五套.id.replace(/第5套$/, `第${套号}套`);
            if (Array.from(选择组.querySelectorAll('input[data-function="radio"]')).some(单选框 => 单选框.id == 新单选框ID)) {
                continue;
            }
            const 新标签 = 原标签.cloneNode(true);
            const 新单选框 = 新标签.querySelector('input[data-function="radio"]');
            新单选框.id = 新单选框ID;
            新单选框.checked = false;
            新标签.querySelector('.radio-circle').classList.remove('checked');
            新标签.querySelector('a').textContent = `第${套号}套`;
            选择组.appendChild(新标签);
        }

        选择组.querySelectorAll('input[data-function="radio"]').forEach(单选框 => {
            const 匹配 = 单选框.id.match(/_第([1-8])套$/);
            if (匹配 == null) {
                return;
            }
            const 标签 = 单选框.closest('.custom-radio');
            标签.querySelector('a').textContent = `${匹配[1]}套`;
            标签.title = `第${匹配[1]}套`;
            单选框.setAttribute('aria-label', `第${匹配[1]}套`);
        });
    });
}

function 补齐下拉战斗套数选项(根节点) {
    const 查询根节点 = 根节点 || document;
    查询根节点.querySelectorAll('.select-box[id$="_战斗选择"] .options-list').forEach(选项列表 => {
        for (let 套号 = 6; 套号 <= 战斗方法_套数上限; 套号++) {
            if (Array.from(选项列表.children).some(选项 => 选项.textContent.trim() == `第${套号}套`)) {
                continue;
            }
            const 选项 = document.createElement('div');
            选项.className = 'option';
            选项.textContent = `第${套号}套`;
            选项列表.appendChild(选项);
        }
    });
}

补齐任务战斗套数选项();
补齐下拉战斗套数选项();

const 单选框值映射 = {
    '本地号_好友分组1': '好友分组1',
    '本地号_对方ID': '对方ID',
    '仓库号_好友分组1': '好友分组1',
    '仓库号_对方ID': '对方ID'
};

const 仓库多选框ID = [
    'check_仓库号_低价值',
    'check_仓库号_高价值',
    'check_仓库号_环装',
    'check_仓库号_飞行符',
    'check_仓库号_二级药',
    'check_仓库号_三烹家',
    'check_仓库号_三药',
    'check_仓库号_烹饪',
    'check_仓库号_家具',
    'check_仓库号_宝图',
    'check_仓库号_摆摊卖飞行符',
    'check_仓库号_摆摊卖二级药',
    'check_仓库号_站街接收一切物品'
];
const 仓库基础物品 = [
    '仓库号_低价值',
    '仓库号_高价值',
    '仓库号_环装',
    '仓库号_飞行符',
    '仓库号_二级药',
    '仓库号_三烹家',
    '仓库号_三药',
    '仓库号_烹饪',
    '仓库号_家具'
];
const 仓库特殊功能ID = [
    'check_仓库号_宝图',
    'check_仓库号_摆摊卖飞行符',
    'check_仓库号_摆摊卖二级药',
    'check_仓库号_站街接收一切物品'
];

// AI-VERIFY[MHXY-FOLLOW-AUTO-ONLY-001][2026-10-08][review-after=2026-10-18]
// 跟队挂自动时，八套打法只展示原设置；取消自动或换流程即可继续编辑。
function 同步跟队自动限制() {
    const 战斗页 = document.getElementById("战斗方法box");
    if (!战斗页) return;
    const 开关 = document.getElementById("check_跟队_挂自动");
    const data = 已读取主配置数据 || {};
    const 挂自动 = 开关 ? 开关.checked : data.跟队_挂自动 === "true" || data.跟队_挂自动 === true;
    const 流程名 = document.getElementById("流程1").style.border === "3px solid rgb(37, 99, 235)" ? "流程信息1" : "流程信息2";
    const 当前流程 = document.getElementById(流程名).textContent;
    const 禁用 = 挂自动 && 当前流程.split("➠").includes("跟队");
    战斗页.classList.toggle("跟队自动禁用", 禁用);
    document.getElementById("跟队自动战斗提醒").hidden = !禁用;
    战斗页.querySelectorAll('.select-box[id^="下拉框_套路"]').forEach(下拉框 => {
        下拉框.setAttribute("aria-disabled", String(禁用));
        if (禁用) closeSelectBox(下拉框);
    });
    战斗页.querySelectorAll('.gendui_content-box:not(#战斗方法_content说明) input, .gendui_content-box:not(#战斗方法_content说明) select, .gendui_content-box:not(#战斗方法_content说明) textarea, .gendui_content-box:not(#战斗方法_content说明) button').forEach(控件 => {
        控件.disabled = 禁用;
    });
}

function 处理开关变化(开关) {
    // 开启前先保持关闭，只有确认弹窗才写入测试区配置。
    if (开关.id === "check_测试区" && 开关.checked) {
        开关.checked = false;
        showbox("是否确定你的区服是测试区？", 1, "开启测试区");
        return;
    }
    const isChecked = 开关.checked;
    const name = 开关.name.replace("check_", "");
    if (isChecked && (name == "教师节_手动答题" || name == "教师节_手动打开答题界面")) {
        const otherName = name == "教师节_手动答题" ? "教师节_手动打开答题界面" : "教师节_手动答题";
        const otherSwitch = document.getElementById("check_" + otherName);
        if (otherSwitch) {
            otherSwitch.checked = false;
        }
        window.bridge.sendToLua(`开关,${otherName},false`);
    }
    const configNames = name == "带队串联测试开关"
        ? ["带队串联测试开关", "组队通讯V2测试开关"]
        : [name];
    configNames.forEach(configName => {
        window.bridge.sendToLua(`开关,${configName},${isChecked}`);
    });
    if (name === "跟队_挂自动") 同步跟队自动限制();
}

function 处理单选框点击(单选框) {
    const radioCircle = 单选框.closest('.custom-radio').querySelector('.radio-circle');
    const 战斗套数 = 单选框.id.match(/_(第[1-8]套)$/);
    const radiovalue = 战斗套数 ? 战斗套数[1] : (单选框值映射[单选框.id] || 单选框.id);

    if (radioCircle.classList.contains('checked')) {
        return;
    }

    Array.from(document.getElementsByName(单选框.name)).forEach(同组单选框 => {
        const circle = 同组单选框.closest('.custom-radio').querySelector('.radio-circle');
        circle.classList.remove('checked');
    });
    单选框.checked = true;
    radioCircle.classList.add('checked');
    window.bridge.sendToLua(`单选框,${单选框.name},${radiovalue}`);
}

function 设置多选框状态(id, checked) {
    const 多选框 = document.getElementById(id);
    if (多选框) {
        多选框.checked = checked;
    }
}

function 处理多选框变化(多选框) {
    const isChecked = 多选框.checked;
    var name_ = 多选框.id.replace("check_", "");
    if (name_ == "宝石商人") {
        name_ = "从哪取图_宝石商人";
    } else if (name_ == "买图") {
        name_ = "从哪取图_买图";
    }

    if (仓库基础物品.includes(name_)) {
        仓库特殊功能ID.forEach(id => 设置多选框状态(id, false));
    } else {
        仓库多选框ID
            .filter(id => id !== `check_${name_}`)
            .forEach(id => 设置多选框状态(id, false));
    }

    window.bridge.sendToLua(`多选框,${name_},${isChecked}`);
}

function 处理输入框失去焦点(输入框) {
    const inputValue = 输入框.value;
    const inputName = 输入框.id.replace("输入框_", "");

    if (inputName == "将军令token") {
        const str = inputValue.split("\n").join("换行符");
        window.bridge.sendToLua("其他输入框," + inputName + "," + str);
        return;
    }

    const 其他输入框名称 = ",卡密,卡密_2,卡密_3,密保卡I,密保卡II,密保卡III,将军令token,";
    if (其他输入框名称.includes("," + inputName + ",")) {
        if (inputName == "卡密" || inputName == "卡密_2" || inputName == "卡密_3") {
            document.getElementById("btn_弹出购买宠物界面").style.display = inputValue.includes("tanze") ? "flex" : "none";
            document.getElementById("btn_弹出炼化界面").style.display = inputValue.includes("tan1") ? "flex" : "none";
        }
        window.bridge.sendToLua("其他输入框," + inputName + "," + inputValue);
        return;
    }

    window.bridge.sendToLua(`输入框,${inputName},${inputValue}`);
}

document.addEventListener('change', function (event) {
    const target = event.target;
    if (target.matches('.switch input[type="checkbox"]')) {
        处理开关变化(target);
    } else if (target.matches('.Checkbox input[name="checkbox"]')) {
        处理多选框变化(target);
    }
});

document.addEventListener('click', function (event) {
    const 单选框 = event.target.closest('.custom-radio input[data-function="radio"]');
    if (单选框) {
        处理单选框点击(单选框);
        return;
    }

    const 流程按钮 = event.target.closest('.beixuan_button');
    if (流程按钮) {
        处理流程按钮点击(流程按钮);
        return;
    }

    const 人物加点线段 = event.target.closest('.线段');
    if (人物加点线段) {
        处理人物加点线段点击(人物加点线段);
        return;
    }

    const 宠物加点线段 = event.target.closest('._线段');
    if (宠物加点线段) {
        处理宠物加点线段点击(宠物加点线段);
    }
});

document.addEventListener('blur', function (event) {
    const target = event.target;
    if (放大输入框正在移位) return;
    if (target.matches('.input, .inputBox, .inputBox1')) {
        处理输入框失去焦点(target);
    }
}, true);


const 流程按钮列表 = Array.from(document.querySelectorAll('.beixuan_button'));

function 处理流程按钮点击(流程按钮) {
    // 每次点击短暂变色，重复点击复用同一个恢复计时器。
    clearTimeout(流程按钮.反馈定时器);
    流程按钮.classList.add('任务按钮反馈');
    流程按钮.反馈定时器 = setTimeout(function () {
        流程按钮.classList.remove('任务按钮反馈');
        流程按钮.反馈定时器 = null;
    }, 160);
    const selectedProcess = document.querySelector('[id^="流程"]').style.border === '3px solid rgb(37, 99, 235)'
        ? '流程信息1'
        : '流程信息2';
    const processInfo = document.getElementById(selectedProcess);
    const title = 流程按钮.title;
    // 教师节允许接在跟队前，其他蓝色任务仍按原来的单选处理。
    const currentTasks = processInfo.textContent.split('➠');
    const teacherBeforeFollow = (title === '跟队' && currentTasks.includes('教师节'))
        || (title === '教师节' && currentTasks.includes('跟队'));
    if (teacherBeforeFollow) {
        processInfo.textContent = '教师节➠跟队';
        window.bridge.sendToLua(selectedProcess + ',' + processInfo.textContent);
        同步跟队自动限制();
        return;
    }
    // AI-VERIFY[MHXY-HOME-TASK-KIND-001][2026-10-03][review-after=2026-10-13]
    // 跨类误点不清空已选流程；同类仍走原组合和蓝色单选规则。
    const 新任务为单人 = 计划启动读取方式([title]) === 'SOLO';
    for (const 当前任务 of currentTasks) {
        if (当前任务.trim() !== '' && (计划启动读取方式([当前任务]) === 'SOLO') !== 新任务为单人) {
            showbox('单人任务只能和单人任务组合\n组队任务只能和组队任务组合', 3, '任务组合提示');
            return;
        }
    }
    const isBlueButton = 流程按钮.style.color === 'rgb(0, 138, 255)';
    const hasBlueButton = 流程按钮列表.some(button =>
        button.style.color === 'rgb(0, 138, 255)' &&
        processInfo.textContent.includes(button.title)
    );

    if (isBlueButton || hasBlueButton) {
        processInfo.textContent = '';
    }

    const tasks = processInfo.textContent === ''
        ? []
        : processInfo.textContent.split('➠');
    if (tasks.length >= 11) {
        return;
    }

    processInfo.textContent = processInfo.textContent === ''
        ? title
        : processInfo.textContent + '➠' + title;
    window.bridge.sendToLua(selectedProcess + ',' + processInfo.textContent);
    同步跟队自动限制();
}
function 显示删除按钮反馈(按钮) {
    clearTimeout(按钮.反馈定时器);
    按钮.classList.add('删除按钮反馈');
    按钮.反馈定时器 = setTimeout(function () {
        按钮.classList.remove('删除按钮反馈');
        按钮.反馈定时器 = null;
    }, 160);
}

清空1.onclick = function () {
    // 阻止事件冒泡
    event.stopPropagation();
    显示删除按钮反馈(清空1);
    var str = 流程信息1.textContent;
    var s_arr = str.split("➠");

    // 如果数组长度大于1，则保留前n-1个元素
    if (s_arr.length > 1) {
        流程信息1.textContent = s_arr.slice(0, s_arr.length - 1).join("➠");
    } else {
        // 如果只有一个元素，则清空
        流程信息1.textContent = null;
    }

    // 发送更新后的流程信息到Lua
    window.bridge.sendToLua("流程信息1" + "," + (流程信息1.textContent || "nil"));
    同步跟队自动限制();
};
清空2.onclick = function () {
    // 阻止事件冒泡
    event.stopPropagation();
    显示删除按钮反馈(清空2);
    var str = 流程信息2.textContent;
    var s_arr = str.split("➠");

    // 如果数组长度大于1，则保留前n-1个元素
    if (s_arr.length > 1) {
        流程信息2.textContent = s_arr.slice(0, s_arr.length - 1).join("➠");

    } else {
        // 如果只有一个元素，则清空
        流程信息2.textContent = null;
    }
    // 发送更新后的流程信息到Lua
    window.bridge.sendToLua("流程信息2" + "," + (流程信息2.textContent || "nil"));
    同步跟队自动限制();
}
//买旗顺序
var buttons1 = document.getElementsByClassName("beixuan_button1");
for (let i = 0; i < buttons1.length; i++) {
    buttons1[i].onclick = function () {
        let content = 买旗顺序_.textContent;
        let title = buttons1[i].title;

        // 如果已经包含当前选项，直接返回
        if (content.includes(title)) return;

        // 如果内容为空，直接设置
        if (!content) {
            买旗顺序_.textContent = title;
        } else {
            // 检查是否超过最大选项数
            let arr = content.split("➠");
            if (arr.length >= 5) return;

            // 添加新选项
            买旗顺序_.textContent = content + "➠" + title;
        }

        // 发送更新后的信息到Lua
        let text = "买旗顺序" + "," + 买旗顺序_.textContent;
        let newtext = text.replace(/➠/g, '8');
        window.bridge.sendToLua(newtext);
    };
}
清空3.onclick = function () {
    let content = 买旗顺序_.textContent;
    let arr = content.split("➠");

    // 如果数组长度大于1，则删除最后一个元素
    if (arr.length > 1) {
        买旗顺序_.textContent = arr.slice(0, arr.length - 1).join("➠");
    } else {
        // 如果只有一个元素，则清空
        买旗顺序_.textContent = "";
    }
    // 把箭头替换成8
    let newContent = 买旗顺序_.textContent.replace(/➠/g, "8");

    // 发送更新后的信息到Lua
    window.bridge.sendToLua("买旗顺序" + "," + (newContent || "nil"));
};
//设置清空按钮长按事件
function setupLongPressDetector(element, delay) {
    let timeoutId;

    element.addEventListener("touchstart", function (event) {
        timeoutId = setTimeout(function () {
            // 长按事件触发后要执行的代码 
            switch (element.title) {
                case "清空1":
                    流程信息1.textContent = null;
                    window.bridge.sendToLua("流程信息1" + "," + "nil");
                    同步跟队自动限制();
                    break;
                case "清空2":
                    流程信息2.textContent = null;
                    window.bridge.sendToLua("流程信息2" + "," + "nil");
                    同步跟队自动限制();
                    break;
                case "清空3":
                    买旗顺序_.textContent = null;
                    window.bridge.sendToLua("买旗顺序" + "," + "nil");
                    break;
            }
        }, delay);
    });

    element.addEventListener("touchend", function (event) {
        clearTimeout(timeoutId);
    });
}
setupLongPressDetector(document.getElementById("清空1"), 1000); // 1000毫秒（1秒）
setupLongPressDetector(document.getElementById("清空2"), 1000); // 1000毫秒（1秒）
setupLongPressDetector(document.getElementById("清空3"), 1000); // 1000毫秒（1秒）

//人物加点
var 总共 = 0;
var 体质 = 0;
var 魔力 = 0;
var 力量 = 0;
var 耐力 = 0;
var 敏捷 = 0;

function 处理人物加点线段点击(线段) {
    const id = 线段.id;
    const 每次加点 = id.split("_")[2];
    const 属性 = id.replace("加点_", "").replace(/_\d+$/, "");
    const 预计总共 = 总共 + (parseInt(每次加点) - window[属性]);
    if (预计总共 >= 6 || parseInt(每次加点) === window[属性]) {
        return;
    }

    for (let i = 1; i <= 5; i++) {
        document.getElementById(`加点_${属性}_${i}`).style.background = "#888585";
    }
    for (let i = 1; i <= 每次加点; i++) {
        document.getElementById(`加点_${属性}_${i}`).style.background = getColorByAttribute(属性);
        window[属性] = i;
    }
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
}

// 根据属性获取颜色
function getColorByAttribute(属性) {
    switch (属性) {
        case "体质": return "#0bac05";
        case "魔力": return "#054de9";
        case "力量": return "#e90505";
        case "耐力": return "#e96c05";
        case "敏捷": return "#05dae9";
        default: return "#888585";
    }
}
体质_减.onclick = function () {
    if (体质 == 0) {
        return;
    }
    var cc = document.getElementById("加点_体质_" + 体质);
    cc.style.background = "#888585";
    体质 = 体质 - 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
体质_加.onclick = function () {
    if ((体质 == 5) | (总共 == 5)) {
        return;
    }
    var cc = document.getElementById("加点_体质_" + (体质 + 1));
    cc.style.background = "#0bac05";
    体质 = 体质 + 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
魔力_减.onclick = function () {
    if (魔力 == 0) {
        return;
    }
    var cc = document.getElementById("加点_魔力_" + 魔力);
    cc.style.background = "#888585";
    魔力 = 魔力 - 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
魔力_加.onclick = function () {
    if ((魔力 == 5) | (总共 == 5)) {
        return;
    }
    var cc = document.getElementById("加点_魔力_" + (魔力 + 1));
    cc.style.background = "#054de9";
    魔力 = 魔力 + 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
力量_减.onclick = function () {
    if (力量 == 0) {
        return;
    }
    var cc = document.getElementById("加点_力量_" + 力量);
    cc.style.background = "#888585";
    力量 = 力量 - 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
力量_加.onclick = function () {
    if ((力量 == 5) | (总共 == 5)) {
        return;
    }
    var cc = document.getElementById("加点_力量_" + (力量 + 1));
    cc.style.background = "#e90505";
    力量 = 力量 + 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
耐力_减.onclick = function () {
    if (耐力 == 0) {
        return;
    }
    var cc = document.getElementById("加点_耐力_" + 耐力);
    cc.style.background = "#888585";
    耐力 = 耐力 - 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
耐力_加.onclick = function () {
    if ((耐力 == 5) | (总共 == 5)) {
        return;
    }
    var cc = document.getElementById("加点_耐力_" + (耐力 + 1));
    cc.style.background = "#e96c05";
    耐力 = 耐力 + 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
敏捷_减.onclick = function () {
    if (敏捷 == 0) {
        return;
    }
    var cc = document.getElementById("加点_敏捷_" + 敏捷);
    cc.style.background = "#888585";
    敏捷 = 敏捷 - 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};
敏捷_加.onclick = function () {
    if ((敏捷 == 5) | (总共 == 5)) {
        return;
    }
    var cc = document.getElementById("加点_敏捷_" + (敏捷 + 1));
    cc.style.background = "#05dae9";
    敏捷 = 敏捷 + 1;
    总共 = 体质 + 魔力 + 力量 + 耐力 + 敏捷;
    剩余显示.innerHTML = 5 - 总共;
    刷新起号加点("", true);
};

//宠物加点
var _总共 = 0;
var _体质 = 0;
var _魔力 = 0;
var _力量 = 0;
var _耐力 = 0;
var _敏捷 = 0;

function 处理宠物加点线段点击(线段) {
    const arr = 线段.id.split("_");
    const 每次加点 = arr[3];
    const 属性 = arr[2];
    const 预计总共 = _总共 + (parseInt(每次加点) - window[`_${属性}`]);
    if (预计总共 >= 6 || parseInt(每次加点) === window[`_${属性}`]) {
        return;
    }

    for (let i = 1; i <= 5; i++) {
        document.getElementById(`_加点_${属性}_${i}`).style.background = "#888585";
    }
    for (let i = 1; i <= 每次加点; i++) {
        document.getElementById(`_加点_${属性}_${i}`).style.background = getColorByAttribute(属性);
        window[`_${属性}`] = i;
    }
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
}

_体质_减.onclick = function () {
    if (_体质 == 0) {
        return;
    }
    var _cc = document.getElementById("_加点_体质_" + _体质);
    _cc.style.background = "#888585";
    _体质 = _体质 - 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_体质_加.onclick = function () {
    if ((_体质 == 5) | (_总共 == 5)) {
        return;
    }
    var _cc = document.getElementById("_加点_体质_" + (_体质 + 1));
    _cc.style.background = "#0bac05";
    _体质 = _体质 + 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_魔力_减.onclick = function () {
    if (_魔力 == 0) {
        return;
    }
    var _cc = document.getElementById("_加点_魔力_" + _魔力);
    _cc.style.background = "#888585";
    _魔力 = _魔力 - 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_魔力_加.onclick = function () {
    if ((_魔力 == 5) | (_总共 == 5)) {
        return;
    }
    var _cc = document.getElementById("_加点_魔力_" + (_魔力 + 1));
    _cc.style.background = "#054de9";
    _魔力 = _魔力 + 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_力量_减.onclick = function () {
    if (_力量 == 0) {
        return;
    }
    var _cc = document.getElementById("_加点_力量_" + _力量);
    _cc.style.background = "#888585";
    _力量 = _力量 - 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_力量_加.onclick = function () {
    if ((_力量 == 5) | (_总共 == 5)) {
        return;
    }
    var _cc = document.getElementById("_加点_力量_" + (_力量 + 1));
    _cc.style.background = "#e90505";
    _力量 = _力量 + 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_耐力_减.onclick = function () {
    if (_耐力 == 0) {
        return;
    }
    var _cc = document.getElementById("_加点_耐力_" + _耐力);
    _cc.style.background = "#888585";
    _耐力 = _耐力 - 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_耐力_加.onclick = function () {
    if ((_耐力 == 5) | (_总共 == 5)) {
        return;
    }
    var _cc = document.getElementById("_加点_耐力_" + (_耐力 + 1));
    _cc.style.background = "#e96c05";
    _耐力 = _耐力 + 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_敏捷_减.onclick = function () {
    if (_敏捷 == 0) {
        return;
    }
    var _cc = document.getElementById("_加点_敏捷_" + _敏捷);
    _cc.style.background = "#888585";
    _敏捷 = _敏捷 - 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};
_敏捷_加.onclick = function () {
    if ((_敏捷 == 5) | (_总共 == 5)) {
        return;
    }
    var _cc = document.getElementById("_加点_敏捷_" + (_敏捷 + 1));
    _cc.style.background = "#05dae9";
    _敏捷 = _敏捷 + 1;
    _总共 = _体质 + _魔力 + _力量 + _耐力 + _敏捷;
    _剩余显示.innerHTML = 5 - _总共;
    刷新起号加点("_", true);
};


// AI-VERIFY[MHXY-H5-INLINE-ATTRIBUTES-001][2026-09-12][review-after=2026-09-22]
// 加点常驻起号页；有效修改即时发送原协议，配置回填只刷新、不发送。
function 刷新起号加点(前缀, 保存) {
    const 属性名 = ["体质", "魔力", "力量", "耐力", "敏捷"];
    const 合计 = 属性名.reduce((总数, 属性) => 总数 + window[前缀 + 属性], 0);
    window[前缀 + "总共"] = 合计;
    document.getElementById(前缀 + "剩余显示").textContent = 5 - 合计;
    属性名.forEach(属性 => {
        const 点数 = window[前缀 + 属性];
        document.getElementById(前缀 + 属性 + "_减").disabled = 点数 === 0;
        document.getElementById(前缀 + 属性 + "_加").disabled = 点数 === 5 || 合计 >= 5;
        for (let i = 1; i <= 5; i++) {
            const 按钮 = document.getElementById(前缀 + "加点_" + 属性 + "_" + i);
            按钮.setAttribute("aria-pressed", String(i === 点数));
            按钮.disabled = 合计 - 点数 + i > 5;
        }
    });
    if (保存) {
        const 名称 = 前缀 ? "宠物属性加点" : "人物属性加点";
        window.bridge.sendToLua(名称 + "," + 属性名.map(属性 => 属性 + "_" + window[前缀 + 属性]).join("|"));
    }
}

function 回填起号加点(前缀, 配置值) {
    if (配置值 != undefined && 配置值 != null) {
        const 属性名 = ["体质", "魔力", "力量", "耐力", "敏捷"];
        属性名.forEach(属性 => { window[前缀 + 属性] = 0; });
        配置值.split("|").forEach(项目 => {
            const 分段 = 项目.split("_");
            const 点数 = parseInt(分段[1]);
            if (属性名.indexOf(分段[0]) >= 0 && 点数 >= 0 && 点数 <= 5) {
                window[前缀 + 分段[0]] = 点数;
            }
        });
    }
    刷新起号加点(前缀, false);
}

刷新起号加点("", false);
刷新起号加点("_", false);

// 按钮按压反馈由 CSS 处理，不再为每次点击创建光圈节点。























// 下拉框统一委托：动态创建的战斗套数页面无需再次绑定监听。
let openSelectBox = null;
let 下拉框布局版本 = 0;
window.addEventListener('resize', function () {
    下拉框布局版本++;
    if (openSelectBox && openSelectBox.closest('.天降生肖行')) {
        closeSelectBox(openSelectBox);
    }
});

document.addEventListener('scroll', function (event) {
    if (openSelectBox && openSelectBox.closest('.天降生肖行') &&
        event.target !== openSelectBox.querySelector('.options-list')) {
        closeSelectBox(openSelectBox);
    }
}, true);

function closeSelectBox(selectBox) {
    if (!selectBox) {
        return;
    }

    const optionsList = selectBox.querySelector('.options-list');
    selectBox.classList.remove('active');
    if (optionsList) {
        optionsList.classList.remove('active');
    }

    if (openSelectBox === selectBox) {
        openSelectBox = null;
    }
}

// AI-VERIFY[MHXY-H5-SUPPLY-BARS-001][2026-09-12][review-after=2026-09-22]
// 血蓝滑条仍使用原下拉框配置；拖动只更新显示，松手沿用原入口保存。
function 更新组队补给条(滑条) {
    const 血蓝条 = 滑条.closest('.组队补给项');
    血蓝条.querySelector('.组队补给填充').style.width = 滑条.value + '%';
    血蓝条.querySelector('.组队补给读数 b').textContent = 滑条.value + '%';
    滑条.setAttribute('aria-valuetext', 滑条.value + '%');
}

function 同步组队补给条(根节点) {
    根节点.querySelectorAll('.组队补给滑条').forEach(滑条 => {
        const 文本 = 滑条.closest('.组队补给项').querySelector('.select span').textContent;
        if (文本.trim() !== '' && isFinite(Number(文本))) {
            滑条.value = 文本;
        }
        更新组队补给条(滑条);
    });
}

document.addEventListener('input', function (event) {
    if (event.target.matches('.组队补给滑条')) {
        更新组队补给条(event.target);
    }
});

document.addEventListener('change', function (event) {
    const 滑条 = event.target;
    if (!滑条.matches('.组队补给滑条')) {
        return;
    }
    const 选项列表 = 滑条.closest('.组队补给项').querySelector('.options-list');
    const 选项 = 获取下拉框选项(选项列表, 滑条.value);
    if (选项) {
        选择下拉框选项(选项);
    }
});

function 获取下拉框选项(optionsList, text) {
    const optionCount = optionsList.children.length;
    if (!optionsList._optionByText || optionsList._optionCount !== optionCount) {
        const optionByText = new Map();
        Array.from(optionsList.children).forEach(option => {
            const optionValue = option.hasAttribute('data-value') ? option.getAttribute('data-value') : option.textContent;
            optionByText.set(optionValue, option);
            optionByText.set(option.textContent, option);
        });
        optionsList._optionByText = optionByText;
        optionsList._optionCount = optionCount;
    }
    return optionsList._optionByText.get(text) || null;
}

function 获取下拉框高度(optionsList) {
    const optionCount = optionsList.children.length;
    if (optionsList._heightOptionCount === optionCount &&
        optionsList._heightLayoutVersion === 下拉框布局版本) {
        return optionsList._cachedHeight;
    }

    const originalVisibility = optionsList.style.visibility;
    const originalMaxHeight = optionsList.style.maxHeight;
    optionsList.style.maxHeight = 'none';
    optionsList.style.visibility = 'hidden';
    optionsList.classList.add('active');
    const height = optionsList.getBoundingClientRect().height;
    optionsList.classList.remove('active');
    optionsList.style.visibility = originalVisibility;
    optionsList.style.maxHeight = originalMaxHeight;
    optionsList._cachedHeight = height;
    optionsList._heightOptionCount = optionCount;
    optionsList._heightLayoutVersion = 下拉框布局版本;
    return height;
}

function 选择下拉框选项(option) {
    const selectBox = option.closest('.select-box');
    if (selectBox.getAttribute('aria-disabled') === 'true') {
        closeSelectBox(selectBox);
        return;
    }
    const select = selectBox.querySelector('.select');
    const optionsList = selectBox.querySelector('.options-list');
    if (!select || !optionsList) {
        return;
    }

    const name = selectBox.id.replace("下拉框_", '');
    const selectedText = option.hasAttribute('data-value') ? option.getAttribute('data-value') : option.textContent;
    select.querySelector('span').textContent = selectedText ? option.textContent : selectedText;
	if (typeof 记录下拉框会话配置 === 'function') {
		记录下拉框会话配置(name, selectedText);
	}

    window.bridge.sendToLua(`下拉框,${name},${selectedText}`);

    const previousOption = optionsList.querySelector('.option.selected');
    if (previousOption && previousOption !== option) {
        previousOption.classList.remove('selected');
    }
    option.classList.add('selected');
    closeSelectBox(selectBox);
}

// AI-VERIFY[MHXY-H5-DROPDOWN-SPACE-001][2026-09-30][review-after=2026-10-10]
// 天降战斗列表可向上覆盖导航；其他下拉框仍按原面板空间展开，保存行为不变。
function 切换下拉框(selectBox) {
    if (selectBox.getAttribute('aria-disabled') === 'true') {
        closeSelectBox(selectBox);
        return;
    }
    const select = selectBox.querySelector('.select');
    const optionsList = selectBox.querySelector('.options-list');
    if (!select || !optionsList) {
        return;
    }

    const isOpen = selectBox.classList.contains('active');
    if (openSelectBox && openSelectBox !== selectBox) {
        closeSelectBox(openSelectBox);
    }
    if (isOpen) {
        closeSelectBox(selectBox);
        return;
    }

    const selectRect = select.getBoundingClientRect();
    const optionsHeight = 获取下拉框高度(optionsList);
    if (selectBox.closest('.天降生肖行')) {
        const availableHeight = Math.max(0, window.innerHeight - 8);
        optionsList.style.maxHeight = availableHeight + 'px';
        optionsList.style.width = selectRect.width + 'px';
        optionsList.style.left = selectRect.left + 'px';
        optionsList.style.top = Math.max(4, selectRect.top - Math.min(optionsHeight, availableHeight) - 4) + 'px';
        optionsList.style.bottom = 'auto';
    } else {
        const visibleContainer = selectBox.closest('.组队任务box, #战斗块');
        let visibleTop = 0;
        let visibleBottom = window.innerHeight;
        // 同时避开设置页等祖先的裁切区域，不能只按整块屏幕计算空位。
        for (let container = selectBox.parentElement; container && container !== document.body; container = container.parentElement) {
            const overflowY = window.getComputedStyle(container).overflowY;
            if (container === visibleContainer || /^(auto|scroll|hidden|clip)$/.test(overflowY)) {
                const rect = container.getBoundingClientRect();
                visibleTop = Math.max(visibleTop, rect.top);
                visibleBottom = Math.min(visibleBottom, rect.bottom);
            }
        }
        const scale = selectRect.height / select.offsetHeight || 1;
        const gap = 4 * scale;
        const spaceBelow = Math.max(0, visibleBottom - selectRect.bottom);
        const spaceAbove = Math.max(0, selectRect.top - visibleTop);
        const openAbove = spaceBelow < optionsHeight + gap && spaceAbove > spaceBelow;
        const availableHeight = Math.max(0, (openAbove ? spaceAbove : spaceBelow) - gap - 2 * scale);
        optionsList.style.maxHeight = Math.floor(availableHeight / scale) + 'px';

        if (openAbove) {
            optionsList.style.top = 'auto';
            optionsList.style.bottom = 'calc(100% + 4px)';
        } else {
            optionsList.style.top = '100%';
            optionsList.style.bottom = 'auto';
        }
    }

    const selectedText = select.querySelector('span').textContent;
    const previousOption = optionsList.querySelector('.option.selected');
    const selectedOption = 获取下拉框选项(optionsList, selectedText);
    if (previousOption && previousOption !== selectedOption) {
        previousOption.classList.remove('selected');
    }
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    selectBox.classList.add('active');
    optionsList.classList.add('active');
    openSelectBox = selectBox;
}

document.addEventListener('click', function (event) {
    const option = event.target.closest('.option');
    if (option && option.closest('.select-box')) {
        选择下拉框选项(option);
        return;
    }

    const select = event.target.closest('.select');
    const selectBox = select ? select.closest('.select-box') : null;
    if (selectBox) {
        切换下拉框(selectBox);
        return;
    }

    closeSelectBox(openSelectBox);
});
//后面不能放东西

// AI-VERIFY[MHXY-H5-INPUT-EDITOR-001][2026-09-13][review-after=2026-09-23]
// 原节点临时移到上方编辑，保留原过滤/字数提示；仅跳过移位造成的失焦，真实失焦仍走原保存。
var 放大输入框正在移位 = false;
(function () {
    var 当前 = null, 参考高度 = window.innerHeight;
    var 遮罩 = document.createElement("div");
    遮罩.id = "通用输入编辑层";
    遮罩.innerHTML = '<div id="通用输入编辑条" role="dialog" aria-modal="true" aria-labelledby="通用输入标题"><div id="通用输入标题"></div><div id="通用输入编辑行"><div id="通用输入容器"></div><button type="button" id="通用输入完成">完成</button></div></div>';
    document.body.appendChild(遮罩);
    var 编辑条 = document.getElementById("通用输入编辑条");
    var 容器 = document.getElementById("通用输入容器");

    function 可放大(输入) {
        if (!输入 || 输入.disabled || 输入.readOnly) return false;
        if (输入.closest("#设备显示设置弹窗")) return false;
        if (输入.tagName !== "TEXTAREA" && !(输入.tagName === "INPUT" && /^(text|number|password|tel|search|url|email)$/.test(输入.type))) return false;
        return !/^输入框_师门_柜台[1-6]$/.test(输入.id) && 输入.id !== "输入框_柜台展示" && 输入.id !== "日志原因输入";
    }

    function 调整位置() {
        if (!当前) return;
        var 可视区 = window.visualViewport;
        var 宽 = 可视区 ? 可视区.width : window.innerWidth;
        var 高 = 可视区 ? 可视区.height : window.innerHeight;
        var 左 = 可视区 ? 可视区.offsetLeft : 0;
        var 顶 = 可视区 ? 可视区.offsetTop : 0;
        编辑条.style.width = Math.min(480, Math.max(240, 宽 * 0.78), 宽 - 20) + "px";
        编辑条.style.left = (左 + (宽 - 编辑条.offsetWidth) / 2) + "px";
        编辑条.style.maxHeight = Math.max(40, 高 - 12) + "px";
        // 以上键盘前高度为基准，避开截图中的顶部输入法工具栏；缩小视口时只收回越界部分。
        编辑条.style.top = (顶 + Math.max(6, Math.min(参考高度 * 0.21, 高 - 编辑条.offsetHeight - 6))) + "px";
    }

    function 归还输入框() {
        if (!当前) return;
        var 原 = 当前;
        当前 = null;
        原.占位.parentNode.replaceChild(原.节点, 原.占位);
        遮罩.style.display = "none";
        for (var i = 0; i < 原.滚动.length; i++) {
            原.滚动[i].节点.scrollTop = 原.滚动[i].上;
            原.滚动[i].节点.scrollLeft = 原.滚动[i].左;
        }
    }

    function 完成编辑() {
        if (!当前) return;
        当前.输入.blur();
        if (当前) 归还输入框();
    }

    document.addEventListener("focus", function (事件) {
        var 输入 = 事件.target;
        if (放大输入框正在移位 || !可放大(输入) || (当前 && 当前.输入 === 输入)) return;
        完成编辑();
        var 节点 = 输入.parentNode.classList.contains("云配置名称编辑") ? 输入.parentNode : 输入;
        var 样式 = window.getComputedStyle(节点), 范围 = 节点.getBoundingClientRect();
        var 占位 = document.createElement("span"), 滚动 = [], 父 = 节点.parentNode;
        占位.setAttribute("aria-hidden", "true");
        占位.style.cssText = "visibility:hidden;pointer-events:none;box-sizing:border-box;";
        占位.style.display = 样式.display === "inline" ? "inline-block" : 样式.display;
        占位.style.width = 范围.width + "px";
        占位.style.height = 范围.height + "px";
        占位.style.margin = 样式.margin;
        占位.style.flex = 样式.flex;
        while (父 && 父.nodeType === 1) {
            滚动.push({ 节点: 父, 上: 父.scrollTop, 左: 父.scrollLeft });
            父 = 父.parentNode;
        }
        var 开始 = 输入.selectionStart, 结束 = 输入.selectionEnd;
        当前 = { 输入: 输入, 节点: 节点, 占位: 占位, 滚动: 滚动 };
        document.getElementById("通用输入标题").textContent = 输入.getAttribute("aria-label") || 输入.id.replace(/^输入框_/, "").replace(/_/g, " · ") || "输入内容";
        参考高度 = Math.max(参考高度, window.innerHeight);
        放大输入框正在移位 = true;
        节点.parentNode.insertBefore(占位, 节点);
        容器.appendChild(节点);
        遮罩.style.display = "block";
        调整位置();
        输入.focus();
        if (开始 !== null && typeof 输入.setSelectionRange === "function") 输入.setSelectionRange(开始, 结束);
        放大输入框正在移位 = false;
    }, true);
    document.addEventListener("blur", function (事件) {
        if (!放大输入框正在移位 && 当前 && 当前.输入 === 事件.target) 归还输入框();
    }, true);
    document.getElementById("通用输入完成").onclick = 完成编辑;
    // 触摸输入框的尾部点击可能落到遮罩；点空白已由真实失焦关闭，无需再处理点击。
    window.addEventListener("resize", 调整位置);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", 调整位置);
        window.visualViewport.addEventListener("scroll", 调整位置);
    }
})();

// AI-VERIFY[MHXY-TEACHING-ASSETS-001][2026-09-13][review-after=2026-09-23]
// 新Lua按图片内容缓存；旧Lua没有URL能力标记，直接查看网络原图。
function 关闭教学图片(弹窗ID) {
    var 弹窗 = document.getElementById(弹窗ID);
    教学图片结束等待(弹窗);
    弹窗.style.display = "none";
}

function 教学图片结束等待(弹窗) {
    clearInterval(弹窗.教学图片轮询);
    弹窗.教学图片轮询 = null;
}

function 教学图片加载失败(弹窗) {
    教学图片结束等待(弹窗);
    弹窗.querySelector(".modal-content").style.display = "none";
    var 提示 = 弹窗.querySelector(".教学图片提示");
    提示.style.display = "block";
    提示.querySelector("span").textContent = "图片没加载出来，请重试";
    提示.querySelector("button").style.display = "inline-block";
}

function 显示教学图片文件(弹窗, 路径) {
    var 图片 = 弹窗.querySelector(".modal-content");
    图片.onload = function () {
        图片.style.display = "block";
        弹窗.querySelector(".教学图片提示").style.display = "none";
    };
    图片.onerror = function () {
        if (路径 !== 图片.getAttribute("data-src")) { 教学图片改用网络(弹窗); }
        else { 教学图片加载失败(弹窗); }
    };
    图片.src = 路径;
}

function 教学图片改用网络(弹窗) {
    教学图片结束等待(弹窗);
    显示教学图片文件(弹窗, 弹窗.querySelector(".modal-content").getAttribute("data-src"));
}

function 处理教学图片结果(原文) {
    var 结果;
    try { 结果 = JSON.parse(原文); } catch (错误) { return; }
    if (!结果 || typeof 结果.id !== "string") { return; }
    var 弹窗列表 = document.querySelectorAll("[data-teaching-id]");
    for (var i = 0; i < 弹窗列表.length; i++) {
        var 弹窗 = 弹窗列表[i];
        if (弹窗.getAttribute("data-teaching-id") !== 结果.id || !弹窗.教学图片轮询) { continue; }
        教学图片结束等待(弹窗);
        if (结果.ok === true && typeof 结果.path === "string" && 结果.path.indexOf("file://") === 0) {
            显示教学图片文件(弹窗, 结果.path);
        } else { 教学图片改用网络(弹窗); }
    }
}

function 打开教学图片(弹窗ID) {
    var 弹窗 = document.getElementById(弹窗ID);
    var 图片 = 弹窗.querySelector(".modal-content");
    弹窗.style.display = "flex";
    if (图片.getAttribute("src") && 图片.complete && 图片.naturalWidth > 0) { return; }
    if (弹窗.教学图片轮询) { return; }
    var 提示 = 弹窗.querySelector(".教学图片提示");
    提示.style.display = "block";
    提示.querySelector("span").textContent = "图片加载中…";
    提示.querySelector("button").style.display = "none";
    if (!/[?&]mhxy_teaching_cache=1(?:&|$)/.test(window.location.search)) {
        显示教学图片文件(弹窗, 图片.getAttribute("data-src"));
        return;
    }
    var 次数 = 0;
    弹窗.教学图片轮询 = setInterval(function () {
        LuaToJs("教学图片结果|");
        次数++;
        if (次数 >= 450 && 弹窗.教学图片轮询) { 教学图片改用网络(弹窗); }
    }, 200);
    try { window.bridge.sendToLua("教学图片," + 弹窗.getAttribute("data-teaching-id")); }
    catch (错误) { 教学图片改用网络(弹窗); }
}

// AI-VERIFY[MHXY-FLAG-GALLERY-001][2026-09-14][review-after=2026-09-24]
// 五张旗图按页复用教学图片缓存；翻页、关闭不修改任何客户配置。
var 十二面旗页码 = 1;
var 十二面旗名称 = ["长安城", "长寿村", "傲来国", "朱紫国", "使用说明"];

function 显示十二面旗页(页码) {
    if (页码 < 1 || 页码 > 十二面旗名称.length) { return; }
    for (var i = 1; i <= 十二面旗名称.length; i++) {
        关闭教学图片("十二面旗第" + i + "页");
    }
    十二面旗页码 = 页码;
    var 页面 = document.getElementById("十二面旗第" + 页码 + "页");
    document.getElementById("十二面旗教学").className = 页码 === 2 ? "旗图竖版" : "";
    document.getElementById("十二面旗放大").textContent = "放大";
    document.getElementById("十二面旗页码").textContent = 页码 + " / 5 · " + 十二面旗名称[页码 - 1];
    document.getElementById("十二面旗上一页").disabled = 页码 === 1;
    document.getElementById("十二面旗下一页").disabled = 页码 === 十二面旗名称.length;
    打开教学图片(页面.id);
    页面.scrollTop = 0;
    页面.scrollLeft = 0;
}

function 切换长寿旗图大小() {
    if (十二面旗页码 !== 2) { return; }
    var 弹窗 = document.getElementById("十二面旗教学");
    var 放大 = 弹窗.className === "旗图竖版";
    弹窗.className = 放大 ? "旗图竖版 旗图放大" : "旗图竖版";
    document.getElementById("十二面旗放大").textContent = 放大 ? "恢复" : "放大";
    document.getElementById("十二面旗第2页").scrollTop = 0;
}

function 打开十二面旗图() {
    document.getElementById("十二面旗教学").style.display = "flex";
    显示十二面旗页(1);
}

function 关闭十二面旗图() {
    关闭教学图片("十二面旗第" + 十二面旗页码 + "页");
    document.getElementById("十二面旗教学").style.display = "none";
}


// AI-VERIFY[MHXY-ROOT-DISPLAY-001][2026-09-14][review-after=2026-09-24]
// 仅按钮发起本机显示请求；临时输入不使用配置输入类，关闭只结束等待。
var 屏幕设置当前请求 = null;
var 屏幕设置轮询id = null;
var 屏幕设置轮询次数 = 0;
var 屏幕设置请求序号 = 0;
var 屏幕设置已确认root = false;

function 屏幕设置是电脑预览() {
    return document.documentElement.getAttribute("data-mhxy-preview-mode") === "readonly"
        || document.documentElement.classList.contains("mhxy-readonly-preview")
        || !window.bridge || typeof window.bridge.sendToLua !== "function"
        || typeof window.bridge.getWorkPath !== "function"
        || typeof window.bridge.readStringFromFile !== "function";
}

function 显示屏幕设置状态(文字, 出错) {
    var 状态 = document.getElementById("设备显示状态");
    状态.textContent = 文字 || "";
    状态.className = "设备显示状态" + (出错 ? " 设备显示错误" : "");
}

function 刷新屏幕设置按钮() {
    var 忙碌 = 屏幕设置当前请求 !== null;
    var 只读 = 屏幕设置是电脑预览();
    var 输入ID = ["设备显示宽", "设备显示高", "设备显示DPI"];
    for (var i = 0; i < 输入ID.length; i++) {
        document.getElementById(输入ID[i]).disabled = 忙碌 || 只读;
    }
    document.getElementById("设备显示设置弹窗").setAttribute("aria-busy", 忙碌 ? "true" : "false");
    document.getElementById("设备显示应用").disabled = 忙碌 || 只读 || !屏幕设置已确认root;
    document.getElementById("设备显示恢复").disabled = 忙碌 || 只读 || !屏幕设置已确认root;
}

function 停止屏幕设置轮询() {
    if (屏幕设置轮询id !== null) {
        clearInterval(屏幕设置轮询id);
        屏幕设置轮询id = null;
    }
    屏幕设置当前请求 = null;
    刷新屏幕设置按钮();
}

function 屏幕设置有其他请求() {
    return (typeof 云配置当前请求 !== "undefined" && 云配置当前请求 !== null)
        || (typeof 查询定时器id !== "undefined" && 查询定时器id != null)
        || (typeof 冻结卡密定时器id !== "undefined" && 冻结卡密定时器id != null)
        || (typeof 日志上传定时器id !== "undefined" && 日志上传定时器id != null)
        || (typeof 日志上传启动定时器id !== "undefined" && 日志上传启动定时器id != null);
}

function 读取屏幕设置整数(ID, 名称, 最小值, 最大值) {
    var 输入 = document.getElementById(ID);
    var 原文 = 输入.value.replace(/^\s+|\s+$/g, "");
    var 数值 = Number(原文);
    if (!/^[0-9]+$/.test(原文) || !isFinite(数值) || Math.floor(数值) !== 数值 || 数值 < 最小值 || 数值 > 最大值) {
        显示屏幕设置状态(名称 + "请填 " + 最小值 + "～" + 最大值 + " 的整数", true);
        输入.focus();
        return null;
    }
    return 数值;
}

function 发送屏幕设置请求(动作) {
    if (屏幕设置当前请求 !== null) return;
    if (动作 !== "query" && 动作 !== "apply" && 动作 !== "restore") return;
    if (屏幕设置是电脑预览()) {
        显示屏幕设置状态("电脑预览不能修改手机分辨率", true);
        刷新屏幕设置按钮();
        return;
    }
    if (屏幕设置有其他请求()) {
        显示屏幕设置状态("云配置、卡密查询或日志上传还没结束，请稍后再试", true);
        return;
    }
    if (动作 !== "query" && !屏幕设置已确认root) {
        显示屏幕设置状态("请在 root 手机上重新打开此窗口", true);
        return;
    }
    var 请求 = {id: String(new Date().getTime()) + "-" + String(++屏幕设置请求序号), action: 动作};
    if (动作 === "apply") {
        请求.width = 读取屏幕设置整数("设备显示宽", "宽度", 200, 8192);
        if (请求.width === null) return;
        请求.height = 读取屏幕设置整数("设备显示高", "高度", 200, 8192);
        if (请求.height === null) return;
        请求.dpi = 读取屏幕设置整数("设备显示DPI", "DPI", 72, 1000);
        if (请求.dpi === null) return;
    }
    var 当前输入 = document.activeElement;
    if (当前输入 && 当前输入.classList.contains("设备显示临时输入")) 当前输入.blur();
    屏幕设置当前请求 = 请求;
    屏幕设置轮询次数 = 0;
    刷新屏幕设置按钮();
    显示屏幕设置状态(动作 === "query" ? "正在读取当前设置…" : (动作 === "apply" ? "正在应用设置…" : "正在恢复手机默认…"));
    屏幕设置轮询id = setInterval(function () {
        屏幕设置轮询次数++;
        LuaToJs("屏幕设置结果|");
        if (屏幕设置当前请求 !== null && 屏幕设置轮询次数 >= 100) {
            停止屏幕设置轮询();
            屏幕设置已确认root = false;
            document.getElementById("设备显示当前值").textContent = "未能读取";
            刷新屏幕设置按钮();
            显示屏幕设置状态("暂未收到结果，请重新打开核对当前设置", true);
        }
    }, 200);
    try {
        window.bridge.sendToLua("屏幕设置请求," + JSON.stringify(请求));
    } catch (错误) {
        停止屏幕设置轮询();
        显示屏幕设置状态("请求未能发出，请重新打开重试", true);
    }
}

function 处理屏幕设置结果(原文) {
    if (屏幕设置当前请求 === null) return;
    var 结果;
    try { 结果 = JSON.parse(原文); } catch (错误) { return; }
    if (!结果 || 结果.id !== 屏幕设置当前请求.id || 结果.action !== 屏幕设置当前请求.action) return;
    停止屏幕设置轮询();
    屏幕设置已确认root = 结果.root === true;
    var 当前 = 结果.current;
    if (当前 && typeof 当前.width === "number" && typeof 当前.height === "number" && typeof 当前.dpi === "number"
        && isFinite(当前.width) && isFinite(当前.height) && isFinite(当前.dpi)
        && 当前.width > 0 && 当前.height > 0 && 当前.dpi > 0
        && Math.floor(当前.width) === 当前.width && Math.floor(当前.height) === 当前.height && Math.floor(当前.dpi) === 当前.dpi) {
        document.getElementById("设备显示当前值").textContent = 当前.width + " × " + 当前.height + " / DPI " + 当前.dpi;
    } else {
        document.getElementById("设备显示当前值").textContent = "未能读取";
    }
    刷新屏幕设置按钮();
    显示屏幕设置状态(typeof 结果.message === "string" ? 结果.message : (结果.ok === true ? "操作完成" : "操作未完成，请重新打开重试"), 结果.ok !== true);
}

function 打开屏幕设置窗口() {
    if (屏幕设置当前请求 !== null) return;
    屏幕设置已确认root = false;
    document.getElementById("设备显示当前值").textContent = "尚未读取";
    document.getElementById("设备显示设置弹窗").style.display = "flex";
    刷新屏幕设置按钮();
    发送屏幕设置请求("query");
}

function 关闭屏幕设置窗口() {
    var 输入 = document.activeElement;
    if (输入 && 输入.classList.contains("设备显示临时输入")) 输入.blur();
    停止屏幕设置轮询();
    if (仅屏幕设置页面 && !屏幕设置是电脑预览()) {
        window.bridge.sendToLua("关闭屏幕设置");
        return;
    }
    document.getElementById("设备显示设置弹窗").style.display = "none";
}

document.getElementById("设备显示设置入口").onclick = 打开屏幕设置窗口;
document.getElementById("设备显示应用").onclick = function () { 发送屏幕设置请求("apply"); };
document.getElementById("设备显示恢复").onclick = function () { 发送屏幕设置请求("restore"); };
document.getElementById("设备显示关闭").onclick = 关闭屏幕设置窗口;
document.getElementById("设备显示设置弹窗").onclick = function (事件) {
    if (事件.target === this) 关闭屏幕设置窗口();
};
document.addEventListener("keydown", function (事件) {
    if ((事件.key === "Escape" || 事件.keyCode === 27) && document.getElementById("设备显示设置弹窗").style.display === "flex") {
        事件.preventDefault();
        关闭屏幕设置窗口();
    }
});
